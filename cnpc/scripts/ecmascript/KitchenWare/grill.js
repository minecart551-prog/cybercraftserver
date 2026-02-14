// Grill Scripted Block
// Events: init, interact, timer, customGuiSlotClicked, customGuiClosed

var guiRef;
var cookingSlots = [];
var coalSlot = null;
var lastBlock = null;
var highlightedSlot = null;
var highlightLineIds = [];

var COOK_TIME = 30; // 30 seconds
var GRID_SIZE = 9; // 3x3 grid

var cookingProgress = {}; // In-memory only, not saved

function init(event) {
    event.block.setModel("farmersdelight:stove");
}

function interact(event) {
    var player = event.player;
    var api = event.API;
    lastBlock = event.block;
    
    openGrillGui(player, api);
}

function getBlockKey(block) {
    return "grill_" + block.getX() + "_" + block.getY() + "_" + block.getZ();
}

function loadGrillData(block, apiOrWorld) {
    var world = block.getWorld();
    var worldData = world.getStoreddata();
    var blockKey = getBlockKey(block);
    
    if(worldData.has(blockKey)){
        try {
            return JSON.parse(worldData.get(blockKey));
        } catch(e) {
            return { slots: {}, coal: null };
        }
    }
    return { slots: {}, coal: null };
}

function saveGrillData(block, data) {
    var world = block.getWorld();
    var worldData = world.getStoreddata();
    var blockKey = getBlockKey(block);
    
    worldData.put(blockKey, JSON.stringify(data));
}

function reloadGrillItemsInGui(block, api) {
    // This function reloads items from storage into the GUI
    // Called by timer to show cooking progress
    if(!guiRef || !cookingSlots || cookingSlots.length === 0) return;
    if(!block) return;
    
    var world = block.getWorld();
    var data = loadGrillData(block, api);
    
    // Reload cooking slots
    for(var i = 0; i < GRID_SIZE; i++){
        if(data.slots[i]){
            try {
                var item = world.createItemFromNbt(api.stringToNbt(data.slots[i]));
                if(cookingSlots[i]) cookingSlots[i].setStack(item);
            } catch(e) {}
        } else {
            if(cookingSlots[i]) cookingSlots[i].setStack(null);
        }
    }
    
    // Reload coal slot
    if(data.coal){
        try {
            var coalItem = world.createItemFromNbt(api.stringToNbt(data.coal));
            if(coalSlot) coalSlot.setStack(coalItem);
        } catch(e) {}
    } else {
        if(coalSlot) coalSlot.setStack(null);
    }
}

function openGrillGui(player, api) {
    if(!lastBlock) return;
    
    guiRef = api.createCustomGui(176, 166, 0, true, player);
    cookingSlots = [];
    highlightedSlot = null;
    highlightLineIds = [];
    
    // Create 3x3 grid of cooking slots (moved up 50 pixels)
    var startX = 55;
    var startY = -45; // Was 20, now -30 (moved up 50)
    var slotSpacing = 18;
    
    for(var row = 0; row < 3; row++){
        for(var col = 0; col < 3; col++){
            var x = startX + col * slotSpacing;
            var y = startY + row * slotSpacing;
            var slot = guiRef.addItemSlot(x, y);
            cookingSlots.push(slot);
        }
    }
    
    // Create coal slot below (moved up 50 pixels)
    coalSlot = guiRef.addItemSlot(73, 26); // Was 90, now 40
    
    // Labels (moved up 50 pixels)
    guiRef.addLabel(1, "§6Grill", 71, -60, 1.2, 1.2); // Was 5, now -45
    guiRef.addLabel(2, "§7Coal", 47, 30, 0.8, 0.8); // Was 93, now 43
    
    // Show player inventory (back to original position)
    guiRef.showPlayerInventory(0, 86, false);
    
    // Load items from storage
    loadGrillItems(player, api);
    
    player.showCustomGui(guiRef);
}

function loadGrillItems(player, api) {
    if(!lastBlock) return;
    
    var data = loadGrillData(lastBlock, api);
    
    // Load cooking slots
    for(var i = 0; i < GRID_SIZE; i++){
        if(data.slots[i]){
            try {
                var item = player.world.createItemFromNbt(api.stringToNbt(data.slots[i]));
                cookingSlots[i].setStack(item);
            } catch(e) {}
        }
    }
    
    // Load coal slot
    if(data.coal){
        try {
            var coalItem = player.world.createItemFromNbt(api.stringToNbt(data.coal));
            coalSlot.setStack(coalItem);
        } catch(e) {}
    }
}

function customGuiClosed(event) {
    if(!lastBlock) return;
    saveGrillItems();
    guiRef = null;
}

function customGuiSlotClicked(event) {
    var clickedSlot = event.slot;
    var stack = event.stack;
    var player = event.player;
    var api = event.API;
    
    // Check if clicked slot is a cooking slot
    var slotIndex = cookingSlots.indexOf(clickedSlot);
    var isCoalSlot = (clickedSlot === coalSlot);
    
    if(slotIndex !== -1) {
        // Clicked a cooking slot
        highlightedSlot = clickedSlot;
        
        // Clear old highlights
        for(var i = 0; i < highlightLineIds.length; i++){
            try { guiRef.removeComponent(highlightLineIds[i]); } catch(e) {}
        }
        highlightLineIds = [];
        
        // Draw highlight
        var row = Math.floor(slotIndex / 3);
        var col = slotIndex % 3;
        var startX = 55;
        var startY = -45;
        var slotSpacing = 18;
        var x = startX + col * slotSpacing;
        var y = startY + row * slotSpacing;
        var w = 18, h = 18;
        
        highlightLineIds.push(guiRef.addColoredLine(1, x, y, x+w, y, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(2, x, y+h, x+w, y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(3, x, y, x, y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(4, x+w, y, x+w, y+h, 0xADD8E6, 2));
        guiRef.update();
        return;
    }
    
    if(isCoalSlot) {
        // Clicked coal slot
        highlightedSlot = clickedSlot;
        
        // Clear old highlights
        for(var i = 0; i < highlightLineIds.length; i++){
            try { guiRef.removeComponent(highlightLineIds[i]); } catch(e) {}
        }
        highlightLineIds = [];
        
        // Draw highlight
        var x = 73, y = 26;
        var w = 18, h = 18;
        
        highlightLineIds.push(guiRef.addColoredLine(1, x, y, x+w, y, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(2, x, y+h, x+w, y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(3, x, y, x, y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(4, x+w, y, x+w, y+h, 0xADD8E6, 2));
        guiRef.update();
        return;
    }
    
    // If no slot is highlighted, return
    if(!highlightedSlot) return;
    
    var slotStack = highlightedSlot.getStack();
    var isHighlightedCoal = (highlightedSlot === coalSlot);
    
    if(stack && !stack.isEmpty()) {
        // Player clicked with item in hand
        if(slotStack && !slotStack.isEmpty()) {
            // Slot already has an item
            if(slotStack.getDisplayName() === stack.getDisplayName()) {
                // Same item
                if(isHighlightedCoal) {
                    // Coal slot - can stack normally
                    var maxStack = stack.getMaxStackSize();
                    var total = slotStack.getStackSize() + stack.getStackSize();
                    if(total <= maxStack) {
                        slotStack.setStackSize(total);
                        highlightedSlot.setStack(slotStack);
                        player.removeItem(stack, stack.getStackSize());
                    } else {
                        var overflow = total - maxStack;
                        slotStack.setStackSize(maxStack);
                        highlightedSlot.setStack(slotStack);
                        if(overflow > 0){
                            var overflowItem = player.world.createItemFromNbt(stack.getItemNbt());
                            overflowItem.setStackSize(overflow);
                            player.removeItem(stack, stack.getStackSize());
                            player.giveItem(overflowItem);
                        }
                    }
                } else {
                    // Cooking slot - already has 1 item, can't add more
                    // Do nothing
                }
            } else {
                // Different item - swap
                var oldItem = slotStack;
                player.giveItem(oldItem);
                
                var itemCopy = player.world.createItemFromNbt(stack.getItemNbt());
                var amountToPlace = isHighlightedCoal ? stack.getStackSize() : 1;
                itemCopy.setStackSize(amountToPlace);
                highlightedSlot.setStack(itemCopy);
                player.removeItem(stack, amountToPlace);
            }
        } else {
            // Slot is empty - place item
            var itemCopy = player.world.createItemFromNbt(stack.getItemNbt());
            var amountToPlace = isHighlightedCoal ? stack.getStackSize() : 1;
            itemCopy.setStackSize(amountToPlace);
            highlightedSlot.setStack(itemCopy);
            player.removeItem(stack, amountToPlace);
        }
    } else if(slotStack && !slotStack.isEmpty()) {
        // Empty hand, take item
        player.giveItem(slotStack);
        highlightedSlot.setStack(player.world.createItem("minecraft:air", 1));
    }
    
    guiRef.update();
    saveGrillItems();
}

function saveGrillItems() {
    if(!lastBlock) return;
    
    var data = { slots: {}, coal: null };
    
    // Save cooking slots
    for(var i = 0; i < cookingSlots.length; i++){
        var stack = cookingSlots[i].getStack();
        
        if(stack && !stack.isEmpty()){
            data.slots[i] = stack.getItemNbt().toJsonString();
        }
    }
    
    // Save coal slot
    var coalStack = coalSlot.getStack();
    if(coalStack && !coalStack.isEmpty()){
        data.coal = coalStack.getItemNbt().toJsonString();
    }
    
    saveGrillData(lastBlock, data);
    
    // Check if we should start or stop the timer
    checkAndUpdateTimer(lastBlock);
}

function checkAndUpdateTimer(block) {
    if(!block) return;
    
    var world = block.getWorld();
    var data = loadGrillData(block, world);
    var API = Java.type("noppes.npcs.api.NpcAPI").Instance();
    
    // Check if there's coal
    var hasCoal = false;
    if(data.coal){
        try {
            var coalItem = world.createItemFromNbt(API.stringToNbt(data.coal));
            if(coalItem && !coalItem.isEmpty() && coalItem.getName() === "minecraft:coal"){
                hasCoal = true;
            }
        } catch(e) {}
    }
    
    // Check if there are any uncookable items
    var hasUncooked = false;
    for(var i = 0; i < GRID_SIZE; i++){
        if(data.slots[i]){
            try {
                var item = world.createItemFromNbt(API.stringToNbt(data.slots[i]));
                if(item && !item.isEmpty() && !isCooked(item)){
                    hasUncooked = true;
                    break;
                }
            } catch(e) {}
        }
    }
    
    var shouldRun = hasCoal && hasUncooked;
    
    if(shouldRun){
        // Start timer if not already running
        block.timers.forceStart(1, 20, true); // Every 1 second, repeating
    } else {
        // Stop timer and reset progress
        block.timers.stop(1);
        
        // Reset cooking progress for items that won't be cooked
        if(!hasCoal || !hasUncooked){
            for(var key in cookingProgress){
                delete cookingProgress[key];
            }
        }
    }
}

function timer(event) {
    // Only process timer ID 1 (our cooking timer)
    if(event.id !== 1) return;
    
    var block = event.block;
    var api = event.API;
    var world = block.getWorld();
    var data = loadGrillData(block, api);
    
    // Check if there's coal
    var hasCoal = false;
    if(data.coal){
        try {
            var coalItem = world.createItemFromNbt(api.stringToNbt(data.coal));
            if(coalItem && !coalItem.isEmpty() && coalItem.getName() === "minecraft:coal"){
                hasCoal = true;
            }
        } catch(e) {}
    }
    
    if(!hasCoal){
        // No coal, stop timer
        block.timers.stop(1);
        // Reset all cooking progress
        for(var key in cookingProgress){
            delete cookingProgress[key];
        }
        return;
    }
    
    var itemsCooked = false;
    var shouldUpdate = false;
    var hasUncooked = false;
    
    // Check each slot
    for(var i = 0; i < GRID_SIZE; i++){
        if(data.slots[i]){
            try {
                var item = world.createItemFromNbt(api.stringToNbt(data.slots[i]));
                
                if(item && !item.isEmpty()){
                    // Cook any item that's not already cooked
                    if(!isCooked(item)){
                        hasUncooked = true;
                        
                        // Start cooking if not already started
                        if(!cookingProgress[i]){
                            cookingProgress[i] = {
                                secondsElapsed: 0,
                                itemNbt: data.slots[i]
                            };
                        }
                        
                        // Increment seconds
                        cookingProgress[i].secondsElapsed++;
                        var secondsRemaining = COOK_TIME - cookingProgress[i].secondsElapsed;
                        
                        if(cookingProgress[i].secondsElapsed >= COOK_TIME){
                            // Item is cooked!
                            var cookedItem = world.createItemFromNbt(api.stringToNbt(data.slots[i]));
                            var existingLore = cookedItem.getLore();
                            var loreArray = [];
                            
                            // Remove cooking timer lines and trailing empty lines
                            for(var j = 0; j < existingLore.length; j++){
                                if(existingLore[j].indexOf("Cooking:") === -1){
                                    loreArray.push(existingLore[j]);
                                }
                            }
                            while(loreArray.length > 0 && loreArray[loreArray.length - 1] === ""){
                                loreArray.pop();
                            }
                            
                            loreArray.push("");
                            loreArray.push("§eCooked");
                            cookedItem.setLore(loreArray);
                            
                            data.slots[i] = cookedItem.getItemNbt().toJsonString();
                            delete cookingProgress[i];
                            itemsCooked = true;
                            shouldUpdate = true;
                        } else {
                            // Update timer
                            var cookingItem = world.createItemFromNbt(api.stringToNbt(data.slots[i]));
                            var existingLore = cookingItem.getLore();
                            var loreArray = [];
                            
                            // Remove cooking timer lines and trailing empty lines
                            for(var j = 0; j < existingLore.length; j++){
                                if(existingLore[j].indexOf("Cooking:") === -1){
                                    loreArray.push(existingLore[j]);
                                }
                            }
                            while(loreArray.length > 0 && loreArray[loreArray.length - 1] === ""){
                                loreArray.pop();
                            }
                            
                            loreArray.push("");
                            loreArray.push("§7Cooking: §e" + secondsRemaining + "s");
                            cookingItem.setLore(loreArray);
                            
                            data.slots[i] = cookingItem.getItemNbt().toJsonString();
                            shouldUpdate = true;
                        }
                    } else {
                        // Already cooked, remove from progress
                        if(cookingProgress[i]){
                            delete cookingProgress[i];
                        }
                    }
                }
            } catch(e) {}
        } else {
            // Slot is empty, remove from progress
            if(cookingProgress[i]){
                delete cookingProgress[i];
            }
        }
    }
    
    // If no more uncooked items, stop timer
    if(!hasUncooked){
        block.timers.stop(1);
        saveGrillData(block, data);
        if(shouldUpdate){
            reloadGrillItemsInGui(block, api);
        }
        return;
    }
    
    // Consume coal if items were cooked
    if(itemsCooked && data.coal){
        try {
            var coalItem = world.createItemFromNbt(api.stringToNbt(data.coal));
            
            if(coalItem && !coalItem.isEmpty()){
                var coalCount = coalItem.getStackSize();
                if(coalCount > 1){
                    coalItem.setStackSize(coalCount - 1);
                    data.coal = coalItem.getItemNbt().toJsonString();
                } else {
                    data.coal = null;
                }
            }
        } catch(e) {}
    }
    
    // Save updated data
    saveGrillData(block, data);
    
    // Reload GUI slots if there were updates
    if(shouldUpdate){
        reloadGrillItemsInGui(block, api);
    }
}

function isCooked(item) {
    var lore = item.getLore();
    for(var i = 0; i < lore.length; i++){
        if(lore[i].indexOf("Cooked") !== -1){
            return true;
        }
    }
    return false;
}