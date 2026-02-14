var managerFound = false;
var menuItems = [];
var counterPos = null;
var navigationSpeed = 0.4;
var scanRadius = 30;
var orderPlaced = false;

var orderedItems = [];
var orderedPrices = [];
var assignedChair = null;
var chairReached = false;
var spawnPos = null;
var guiClosed = false;
var initialized = false;
var returningToSpawn = false;
var myChairIndex = -1;
var paymentReceived = false;
var paymentCheckTicks = 0;
var globalMenuData = {};

// Currency conversion rates
var STONE_TO_COAL = 100;
var COAL_TO_EMERALD = 100;

function parseCoords(str){
    if(!str) return null;
    
    try {
        var obj = JSON.parse(str);
        if(obj && typeof obj.x === "number" && typeof obj.y === "number" && typeof obj.z === "number"){
            return {x: obj.x, y: obj.y, z: obj.z};
        }
    } catch(e) {}
    
    var p = str.split(/[ ,]+/);
    if(p.length < 3) return null;
    var x = parseFloat(p[0]), y = parseFloat(p[1]), z = parseFloat(p[2]);
    if(isNaN(x) || isNaN(y) || isNaN(z)) return null;
    return {x:x, y:y, z:z};
}

function init(event){
    var npc = event.npc;
    var selfData = npc.getStoreddata();
    
    selfData.put("Leave", "false");
    selfData.put("GuiClosed", "false");
    selfData.put("PaymentReceived", "false");
    
    spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
    initialized = true;
}

function getMyId(npc){
    try {
        return npc.getEntityId ? npc.getEntityId().toString() : npc.getName();
    } catch(e) {
        return "customer_" + Math.random();
    }
}

function tryClaimChair(npc, managerNpc){
    if(!managerNpc) return false;
    
    var managerData = managerNpc.getStoreddata();
    if(!managerData.has("ChairList")) return false;
    
    var chairsList;
    try {
        chairsList = JSON.parse(managerData.get("ChairList"));
    } catch(e) {
        return false;
    }
    
    if(!Array.isArray(chairsList) || chairsList.length === 0) return false;
    
    var myId = getMyId(npc);
    
    var managerJobTicks = 0;
    var chairFreeTicks = 600;
    try {
        if(managerData.has("JobTicks")){
            managerJobTicks = parseInt(managerData.get("JobTicks"));
        }
        
        if(managerData.has("ChairFreeTicks")){
            chairFreeTicks = parseInt(managerData.get("ChairFreeTicks"));
        }
    } catch(e) {}
    
    for(var i = 0; i < chairsList.length; i++){
        if(!chairsList[i].taken){
            var freeAt = managerJobTicks + chairFreeTicks;
            chairsList[i].taken = true;
            chairsList[i].freeAtTick = freeAt;
            chairsList[i].occupiedBy = myId;
            
            managerData.put("ChairList", JSON.stringify(chairsList));
            
            var currentCount = 0;
            try {
                if(managerData.has("CurrentCustomerCount")){
                    currentCount = parseInt(managerData.get("CurrentCustomerCount"));
                }
            } catch(e) {}
            currentCount++;
            managerData.put("CurrentCustomerCount", currentCount.toString());
            
            myChairIndex = i;
            assignedChair = {x: chairsList[i].x, y: chairsList[i].y, z: chairsList[i].z};
            
            return true;
        }
    }
    
    return false;
}

function isMyChairExpired(npc, managerNpc){
    if(myChairIndex === -1) return false;
    if(!managerNpc) return false;
    
    var managerData = managerNpc.getStoreddata();
    if(!managerData.has("ChairList")) return false;
    
    var chairsList;
    try {
        chairsList = JSON.parse(managerData.get("ChairList"));
    } catch(e) {
        return false;
    }
    
    if(!Array.isArray(chairsList) || chairsList.length === 0) return false;
    if(myChairIndex < 0 || myChairIndex >= chairsList.length) return false;
    
    var myChair = chairsList[myChairIndex];
    
    var myId = getMyId(npc);
    if(!myChair.taken){
        return true;
    }
    if(myChair.occupiedBy && myChair.occupiedBy !== myId){
        return true;
    }
    
    return false;
}

function isJobStopped(managerNpc){
    if(!managerNpc) return false;
    
    var managerData = managerNpc.getStoreddata();
    if(managerData.has("JobStopped")){
        return managerData.get("JobStopped") === "true";
    }
    return false;
}

function itemsMatch(item1, item2) {
    if (!item1 || !item2) return false;
    
    try {
        var nbt1 = item1.getItemNbt();
        var nbt2 = item2.getItemNbt();
        
        if (!nbt1 || !nbt2) {
            return item1.getName() === item2.getName();
        }
        
        var json1 = nbt1.toJsonString();
        var json2 = nbt2.toJsonString();
        
        json1 = json1.replace(/(\d+)(d|b|s|f|L)\b/g, '$1');
        json2 = json2.replace(/(\d+)(d|b|s|f|L)\b/g, '$1');
        
        var obj1 = JSON.parse(json1);
        var obj2 = JSON.parse(json2);
        
        if (obj1.id !== obj2.id) {
            return false;
        }
        
        var tag1 = obj1.tag || {};
        var tag2 = obj2.tag || {};
        
        var display1 = tag1.display || {};
        var display2 = tag2.display || {};
        
        var name1 = display1.Name || null;
        var name2 = display2.Name || null;
        if (name1 !== name2) {
            return false;
        }
        
        var lore1 = display1.Lore;
        var lore2 = display2.Lore;
        
        // Clean lore first to check if there's any non-price lore
        var lore1Clean = [];
        var lore2Clean = [];
        
        if (lore1 && Array.isArray(lore1)) {
            for (var i = 0; i < lore1.length; i++) {
                var line = String(lore1[i]);
                
                // CustomNPCs may use {"translate":"text"} format
                try {
                    var loreJson = JSON.parse(line);
                    if(loreJson.translate){
                        line = loreJson.translate;
                    }
                } catch(e) {
                    // Not JSON, use as-is
                }
                
                // Only keep non-empty, non-price lore
                if (line && line.trim() !== "" && line.indexOf("Price:") === -1) {
                    lore1Clean.push(line);
                }
            }
        }
        
        if (lore2 && Array.isArray(lore2)) {
            for (var i = 0; i < lore2.length; i++) {
                var line = String(lore2[i]);
                
                // CustomNPCs may use {"translate":"text"} format
                try {
                    var loreJson = JSON.parse(line);
                    if(loreJson.translate){
                        line = loreJson.translate;
                    }
                } catch(e) {
                    // Not JSON, use as-is
                }
                
                // Only keep non-empty, non-price lore
                if (line && line.trim() !== "" && line.indexOf("Price:") === -1) {
                    lore2Clean.push(line);
                }
            }
        }
        
        var hasLore1 = lore1Clean.length > 0;
        var hasLore2 = lore2Clean.length > 0;
        
        if (hasLore1 !== hasLore2) {
            return false;
        }
        
        if (hasLore1 && hasLore2) {
            var lore1Str = JSON.stringify(lore1Clean);
            var lore2Str = JSON.stringify(lore2Clean);
            
            if (lore1Str !== lore2Str) {
                return false;
            }
        }
        
        return true;
    } catch(e) {
        return false;
    }
}

function getLore(item) {
    var lore = [];
    try {
        var nbt = item.getItemNbt();
        if (nbt && nbt.tag && nbt.tag.display && nbt.tag.display.Lore) {
            var loreList = nbt.tag.display.Lore;
            if (Array.isArray(loreList)) {
                for (var i = 0; i < loreList.length; i++) {
                    var line = loreList[i];
                    
                    // CustomNPCs may use {"translate":"text"} format
                    try {
                        var loreJson = JSON.parse(String(line));
                        if(loreJson.translate){
                            line = loreJson.translate;
                        }
                    } catch(e) {
                        // Not JSON, use as-is
                    }
                    
                    var cleanLine = String(line).replace(/[§&][0-9a-fk-or]/gi, '').replace(/["']/g, '');
                    lore.push(cleanLine);
                }
            } else if (typeof loreList === 'object') {
                for (var key in loreList) {
                    var line = loreList[key];
                    
                    // CustomNPCs may use {"translate":"text"} format
                    try {
                        var loreJson = JSON.parse(String(line));
                        if(loreJson.translate){
                            line = loreJson.translate;
                        }
                    } catch(e) {
                        // Not JSON, use as-is
                    }
                    
                    var cleanLine = String(line).replace(/[§&][0-9a-fk-or]/gi, '').replace(/["']/g, '');
                    lore.push(cleanLine);
                }
            }
        }
    } catch(e) {}
    return lore;
}

function findPriceForItem(itemNbtString, api, world) {
    if (!globalMenuData || Object.keys(globalMenuData).length === 0) {
        return null;
    }
    
    var foodToMatch;
    try {
        foodToMatch = world.createItemFromNbt(api.stringToNbt(itemNbtString));
    } catch(e) {
        return null;
    }
    
    for (var key in globalMenuData) {
        if (!globalMenuData.hasOwnProperty(key)) continue;
        
        var entry = globalMenuData[key];
        if (!entry || !entry.item) continue;
        
        try {
            var menuItem = world.createItemFromNbt(api.stringToNbt(entry.item));
            
            if (itemsMatch(menuItem, foodToMatch)) {
                return entry.price;
            }
        } catch(e) {}
    }
    
    return null;
}

function tick(event){
    var npc = event.npc;
    var world = npc.getWorld();
    var api = event.API;

    if(!initialized){
        spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
        initialized = true;
    }
    
    // Load global menu data from world storage
    if(Object.keys(globalMenuData).length === 0){
        var worldData = world.getStoreddata();
        if(worldData.has("GlobalMenuData")){
            try{
                globalMenuData = JSON.parse(worldData.get("GlobalMenuData"));
            }catch(e){
                globalMenuData = {};
            }
        }
    }

    var nearby = world.getNearbyEntities(npc.getX(), npc.getY(), npc.getZ(), scanRadius, 2);
    var managerNpc = null;
    
    for(var i=0; i<nearby.length; i++){
        var other = nearby[i];
        if(!other || !other.getName) continue;
        if(other.getName() === "Manager"){
            var data = other.getStoreddata();

            if(data.has("RestaurantMenu")){
                try{
                    menuItems = JSON.parse(data.get("RestaurantMenu"));
                }catch(e){
                    menuItems = [];
                }
            }

            if(data.has("CounterPos")){
                counterPos = parseCoords(data.get("CounterPos"));
            }

            managerNpc = other;
            managerFound = true;
            break;
        }
    }

    if(managerNpc && isJobStopped(managerNpc)){
        npc.getAi().setAnimation(0);
        returningToSpawn = true;
        assignedChair = null;
        chairReached = false;
    }

    if(orderPlaced && !guiClosed && !assignedChair){
        try{
            var selfData = npc.getStoreddata();
            if(selfData.has("GuiClosed") && selfData.get("GuiClosed") === "true"){
                guiClosed = true;
                selfData.put("GuiClosed", "false");
            }
        }catch(e){}
    }

    if(assignedChair && chairReached && isMyChairExpired(npc, managerNpc)){
        npc.getAi().setAnimation(0);
        returningToSpawn = true;
        assignedChair = null;
        chairReached = false;
        myChairIndex = -1;
    }

    if(assignedChair && chairReached && !paymentReceived){
        paymentCheckTicks++;
        try{
            var selfData = npc.getStoreddata();
            if(selfData.has("PaymentReceived") && selfData.get("PaymentReceived") === "true"){
                paymentReceived = true;
                selfData.put("PaymentReceived", "false");
                
                npc.getAi().setAnimation(0);
                returningToSpawn = true;
                npc.say("Thank you!");
            }
        }catch(e){}
    }

    if(returningToSpawn){
        if(spawnPos){
            var dx = npc.getX() - spawnPos.x;
            var dy = npc.getY() - spawnPos.y;
            var dz = npc.getZ() - spawnPos.z;
            var distSq = dx*dx + dy*dy + dz*dz;
            
            npc.navigateTo(spawnPos.x, spawnPos.y, spawnPos.z, navigationSpeed);
            
            if(distSq < 4.0){
                npc.despawn();
            }
        } else {
            npc.despawn();
        }
        return;
    }

    if(chairReached){
        return;
    }

    if(assignedChair){
        var ddx = npc.getX() - assignedChair.x;
        var ddy = npc.getY() - assignedChair.y;
        var ddz = npc.getZ() - assignedChair.z;
        var distSq = ddx*ddx + ddy*ddy + ddz*ddz;

        npc.navigateTo(assignedChair.x, assignedChair.y, assignedChair.z, navigationSpeed);

        if(distSq < 1.0){
            chairReached = true;
            npc.getAi().setAnimation(1);
        }
        return;
    }

    if(orderPlaced && guiClosed && !assignedChair && managerNpc){
        var claimed = tryClaimChair(npc, managerNpc);
        if(claimed){
            guiClosed = false;
        } else {
            npc.say("No chairs available, waiting at counter.");
            guiClosed = false;
        }
    }

    if(managerFound && counterPos && !orderPlaced){
        npc.navigateTo(counterPos.x, counterPos.y, counterPos.z, navigationSpeed);

        var dx = npc.getX() - counterPos.x;
        var dy = npc.getY() - counterPos.y;
        var dz = npc.getZ() - counterPos.z;

        if(dx*dx + dy*dy + dz*dz < 4){
            orderPlaced = true;
            
            // Reload global menu data at counter
            var worldData = world.getStoreddata();
            if(worldData.has("GlobalMenuData")){
                try{
                    globalMenuData = JSON.parse(worldData.get("GlobalMenuData"));
                }catch(e){
                    globalMenuData = {};
                }
            }

            if(menuItems.length > 0){
                orderedItems = [];
                orderedPrices = [];
                
                var hasPricing = globalMenuData && Object.keys(globalMenuData).length > 0;
                if(!hasPricing){
                    npc.say("Warning: No pricing data loaded yet!");
                }
                
                var orderCount = 1 + Math.floor(Math.random() * 3);
                for(var k=0; k<orderCount; k++){
                    var idx = Math.floor(Math.random() * menuItems.length);
                    var entry = menuItems[idx];
                    var nbt;
                    if(typeof entry === "string"){
                        nbt = api.stringToNbt(entry);
                    }else{
                        nbt = api.stringToNbt(JSON.stringify(entry));
                    }
                    var item = world.createItemFromNbt(nbt);
                    orderedItems.push(item);
                    
                    // Find price for this item from global data
                    var itemPrice = findPriceForItem(entry, api, world);
                    orderedPrices.push(itemPrice);
                }
            }
        }
    }
}

function interact(event){
    var player = event.player;
    var api = event.API;
    var npc = event.npc;
    var world = npc.getWorld();

    if(orderedItems.length === 0){
        player.message("This customer hasn't ordered yet.");
        return;
    }
    
    if(paymentReceived){
        player.message("This customer has already paid.");
        return;
    }
    
    var heldItem = player.getMainhandItem();
    
    if(!heldItem || heldItem.isEmpty()){
        // Group identical items together
        var itemGroups = {}; // Key: itemName + lore, Value: {name, lore, totalCount, price}
        
        for(var i=0; i<orderedItems.length; i++){
            if(orderedItems[i]){
                var itemName = orderedItems[i].getDisplayName();
                var itemCount = orderedItems[i].getStackSize();
                var itemLore = getLore(orderedItems[i]);
                var itemPrice = orderedPrices[i];
                
                // Create unique key based on name and lore (not price)
                var loreKey = itemLore.join("|");
                var groupKey = itemName + "||" + loreKey;
                
                if(!itemGroups[groupKey]){
                    itemGroups[groupKey] = {
                        name: itemName,
                        lore: itemLore,
                        totalCount: 0,
                        totalPrice: 0
                    };
                }
                
                itemGroups[groupKey].totalCount += itemCount;
                if(itemPrice !== null && itemPrice !== undefined){
                    itemGroups[groupKey].totalPrice += itemPrice * itemCount;
                }
            }
        }
        
        // Build display message
        var orderParts = [];
        for(var key in itemGroups){
            if(itemGroups.hasOwnProperty(key)){
                var group = itemGroups[key];
                var displayText = "§ex" + group.totalCount + " §a" + group.name;
                
                if (group.lore.length > 0) {
                    displayText += " §7[" + group.lore.join(", ") + "]";
                }
                
                orderParts.push(displayText);
            }
        }
        
        if(orderParts.length > 0){
            var orderMessage = orderParts.join(" ");
            npc.say(orderMessage);
        }
        
        var gui = api.createCustomGui(102, 180, 0, true, player);
        var label = gui.addLabel(1, "Customer wants:", 46, -50, 150, 12);
        label.setColor(0xFFFFFF);

        var currentX = 52;
        var slotY = -23;
        
        for(var i=0; i<orderedItems.length && i<3; i++){
            var slot = gui.addItemSlot(currentX, slotY);
            if(orderedItems[i]){
                slot.setStack(orderedItems[i]);
            }
            currentX += 25;
        }

        player.showCustomGui(gui);
        return;
    }
    
    var matchedIndex = -1;
    
    for(var i=0; i<orderedItems.length; i++){
        if(orderedItems[i]){
            var matches = itemsMatch(heldItem, orderedItems[i]);
            if(matches){
                matchedIndex = i;
                break;
            }
        }
    }
    
    if(matchedIndex === -1){
        var heldLore = getLore(heldItem);
        var heldInfo = heldItem.getDisplayName() + (heldLore.length > 0 ? " [" + heldLore.join(", ") + "]" : "");
        player.message("§cThis customer didn't order that item! You gave: " + heldInfo);
        return;
    }
    
    if(!orderedItems[matchedIndex]){
        player.message("§cYou already gave this item!");
        return;
    }
    
    var neededAmount = orderedItems[matchedIndex].getStackSize();
    var inv = player.getInventory().getItems();
    var removed = 0;
    
    for(var j=0; j<inv.length && removed < neededAmount; j++){
        var invItem = inv[j];
        if(invItem && itemsMatch(invItem, orderedItems[matchedIndex])){
            var toRemove = Math.min(neededAmount - removed, invItem.getStackSize());
            invItem.setStackSize(invItem.getStackSize() - toRemove);
            removed += toRemove;
        }
    }
    
    if(removed < neededAmount){
        player.message("§cYou need " + neededAmount + " of this item!");
        return;
    }
    
    orderedItems[matchedIndex] = null;
    player.message("§aItem delivered!");
    
    var allDelivered = true;
    for(var i=0; i<orderedItems.length; i++){
        if(orderedItems[i]){
            allDelivered = false;
            break;
        }
    }
    
    if(allDelivered){
        // Calculate total coins and give payment
        var totalCoins = 0;
        for(var i=0; i<orderedPrices.length; i++){
            if(orderedPrices[i] !== null && orderedPrices[i] !== undefined){
                totalCoins += orderedPrices[i];
            }
        }
        
        if(totalCoins > 0){
            // Give coins to player
            var emeralds = Math.floor(totalCoins / (STONE_TO_COAL * COAL_TO_EMERALD));
            var remaining = totalCoins % (STONE_TO_COAL * COAL_TO_EMERALD);
            var coals = Math.floor(remaining / STONE_TO_COAL);
            var stones = remaining % STONE_TO_COAL;
            
            if(emeralds > 0){
                var emeraldItem = player.world.createItem("coins:emerald_coin", emeralds);
                player.giveItem(emeraldItem);
            }
            if(coals > 0){
                var coalItem = player.world.createItem("coins:coal_coin", coals);
                player.giveItem(coalItem);
            }
            if(stones > 0){
                var stoneItem = player.world.createItem("coins:stone_coin", stones);
                player.giveItem(stoneItem);
            }
            
            player.message("§aPayment received: §e" + totalCoins + "¢");
        } else {
            player.message("§aTransaction complete! (No price set)");
        }
        
        paymentReceived = true;
        npc.getStoreddata().put("PaymentReceived", "true");
        npc.say("Thank you!");
    }
}

function customGuiClosed(event){
    try{
        guiClosed = true;
        if(event.npc){
            event.npc.getStoreddata().put("GuiClosed", "true");
        }
    }catch(e){}
}