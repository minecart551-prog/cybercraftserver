// Menu Editor NPC Script - Create and modify menu with prices
// Place this in the NPC's Interact, customGuiButton, customGuiSlotClicked, and customGuiClosed events

var guiRef;                 
var mySlots = [];           
var highlightLineIds = [];  
var highlightedSlot = null; 
var lastNpc = null;         
var storedSlotItems = {};   
var currentPage = 0;        
var maxPages = 5;           
var skipSaveOnClose = false;          

// Viewport system
var viewportRow = 0;        
var viewportRows = 6;       
var totalRows = 20;         
var numCols = 9;            

// Currency conversion rates
var STONE_TO_COAL = 100;
var COAL_TO_EMERALD = 100;

// Component IDs
var ID_PRICE_FIELD = 100;
var ID_SET_PRICE_BUTTON = 101;
var ID_TAB_BASE = 102;
var ID_SCROLL_UP = 111;
var ID_SCROLL_DOWN = 112;
var ID_ROWS_FIELD = 115;
var ID_SET_ROWS_BUTTON = 116;
var ID_ADD_TAB = 117;
var ID_REMOVE_TAB = 118;

function makeNullArray(n){
    var a = new Array(n);
    for (var i = 0; i < n; i++){ a[i] = null; }
    return a;
}

// Load total rows for current tab
function loadTabRowConfig(npcData) {
    if(npcData.has("TabRows")) {
        try {
            var tabRowsConfig = JSON.parse(npcData.get("TabRows"));
            if(tabRowsConfig[currentPage] !== undefined) {
                totalRows = tabRowsConfig[currentPage];
            } else {
                totalRows = 20;
            }
        } catch(e) {
            totalRows = 20;
        }
    } else {
        totalRows = 20;
    }
}

// Save total rows for current tab
function saveTabRowConfig(npcData, rows) {
    var tabRowsConfig = {};
    if(npcData.has("TabRows")) {
        try {
            tabRowsConfig = JSON.parse(npcData.get("TabRows"));
        } catch(e) {}
    }
    tabRowsConfig[currentPage] = rows;
    npcData.put("TabRows", JSON.stringify(tabRowsConfig));
}

// Load max pages
function loadMaxPages(npcData) {
    if(npcData.has("MaxPages")) {
        try {
            maxPages = npcData.get("MaxPages");
            if(maxPages < 1) maxPages = 1;
            if(maxPages > 10) maxPages = 10;
        } catch(e) {
            maxPages = 5;
        }
    } else {
        maxPages = 5;
    }
}

// Save max pages
function saveMaxPages(npcData, pages) {
    npcData.put("MaxPages", pages);
}

// ========== Layout ==========
var slotPositions = [];
var tabSlots = [];
var startX = 0;
var startY = -50;
var rowSpacing = 18;      
var colSpacing = 18;        

for (var row = 0; row < viewportRows; row++) {
    var y = startY + row * rowSpacing;
    for (var col = 0; col < numCols; col++) {
        var x = startX + col * colSpacing;
        slotPositions.push({x: x, y: y});
    }
}

function viewportToGlobal(slotIndex) {
    var localRow = Math.floor(slotIndex / numCols);
    var localCol = slotIndex % numCols;
    var globalRow = viewportRow + localRow;
    return globalRow * numCols + localCol;
}

// ========== Open GUI ==========
function interact(event) {
    var player = event.player;
    var api = event.API;
    lastNpc = event.npc; 
    var npcData = lastNpc.getStoreddata();
    
    // Get world for global data
    var world = lastNpc.getWorld();
    var worldData = world.getStoreddata();
    
    // Load max pages
    loadMaxPages(npcData);
    
    // Load row configuration for this tab
    loadTabRowConfig(npcData);
    
    // Load menu items from NPC storage
    storedSlotItems = npcData.has("MenuItems") 
        ? JSON.parse(npcData.get("MenuItems")) 
        : {};
    
    var adminMode = (player.getMainhandItem() && player.getMainhandItem().getName() === "minecraft:bedrock");
    
    if(!adminMode){
        player.message("§cYou need bedrock in hand to edit the menu!");
        return;
    }
    
    // CLEANUP: Remove any ghost tabs beyond maxPages
    for(var key in storedSlotItems){
        if(storedSlotItems.hasOwnProperty(key)){
            var tabIndex = parseInt(key);
            if(tabIndex >= maxPages){
                delete storedSlotItems[key];
            }
        }
    }
    
    var storedTabItems = npcData.has("TabItems")
        ? JSON.parse(npcData.get("TabItems"))
        : makeNullArray(maxPages);
    
    // Ensure storedTabItems matches current maxPages
    if(storedTabItems.length < maxPages){
        while(storedTabItems.length < maxPages){
            storedTabItems.push(null);
        }
    } else if(storedTabItems.length > maxPages){
        storedTabItems = storedTabItems.slice(0, maxPages);
    }
    
    var totalSlots = totalRows * numCols;
    if(!storedSlotItems[currentPage]){
        storedSlotItems[currentPage] = makeNullArray(totalSlots);
    }
    
    highlightedSlot = null;
    highlightLineIds = [];
    
    if(!guiRef){
        guiRef = api.createCustomGui(176, 166, 0, true, player);
        
        // Tabs
        var tabWidth = 25;
        var tabHeight = 28;
        var tabSpacing = 2;
        var tabStartX = 0;
        var tabY = -80;
        tabSlots = [];
        
        for(var i = 0; i < maxPages; i++){
            var tabX = tabStartX + i * (tabWidth + tabSpacing);
            var tabSlot = guiRef.addItemSlot(tabX + 4, tabY + 5);
            tabSlots.push(tabSlot);
            guiRef.addButton(ID_TAB_BASE + i, "", tabX, tabY, tabWidth, tabHeight);
        }
        
        // Item slots
        mySlots = slotPositions.map(function(pos) {
            return guiRef.addItemSlot(pos.x, pos.y);
        });
        
        // Scroll buttons
        var scrollX = startX + (numCols * colSpacing) + 2;
        var scrollY = startY;
        guiRef.addButton(ID_SCROLL_UP, "↑", scrollX, scrollY, 18, 18);
        guiRef.addButton(ID_SCROLL_DOWN, "↓", scrollX, scrollY + 20, 18, 18);
        
        // Scroll position indicator
        guiRef.addLabel(10, "", scrollX + 1, scrollY + 42, 0.7, 0.7);
        
        // Price/Name section
        guiRef.addLabel(3, "§7Price:", 2, -100, 0.8, 0.8);
        guiRef.addTextField(ID_PRICE_FIELD, 60, -104, 60, 18).setText("");
        guiRef.addButton(ID_SET_PRICE_BUTTON, "Set", 125, -104, 35, 18);
        
        // Tab management buttons
        var tabManageX = (maxPages * 27) + 2;
        guiRef.addButton(ID_ADD_TAB, "+", tabManageX, -80, 16, 14);
        guiRef.addButton(ID_REMOVE_TAB, "-", tabManageX + 18, -80, 16, 14);
        guiRef.addLabel(7, "§7Tabs", tabManageX - 8, -92, 0.7, 0.7);
        
        // Menu Editor title
        guiRef.addLabel(1, "§6Menu Editor", 2, 63, 1.0, 1.0);
        
        // Rows configuration
        guiRef.addLabel(6, "§7Total Rows:", -105, -29, 0.8, 0.8);
        guiRef.addTextField(ID_ROWS_FIELD, -105, -17, 40, 18).setText("" + totalRows);
        guiRef.addButton(ID_SET_ROWS_BUTTON, "Set", -60, -17, 30, 18);
        
        guiRef.showPlayerInventory(3, 91, false);
        
        // Load tab items
        for(var i = 0; i < tabSlots.length; i++){
            if(storedTabItems[i]){
                try {
                    var tabItem = player.world.createItemFromNbt(api.stringToNbt(storedTabItems[i]));
                    tabSlots[i].setStack(tabItem);
                } catch(e) {}
            } else {
                tabSlots[i].setStack(null);
            }
        }
        
        player.showCustomGui(guiRef);
    } else {
        // GUI already exists, reload tab items
        for(var i = 0; i < tabSlots.length; i++){
            if(storedTabItems[i]){
                try {
                    var tabItem = player.world.createItemFromNbt(api.stringToNbt(storedTabItems[i]));
                    tabSlots[i].setStack(tabItem);
                } catch(e) {}
            } else {
                tabSlots[i].setStack(null);
            }
        }
    }
    
    // Add highlight around current tab
    if(guiRef && currentPage < maxPages){
        var tabWidth = 25;
        var tabHeight = 28;
        var tabSpacing = 2;
        var tabStartX = 0;
        var tabY = -80;
        var highlightTabX = tabStartX + currentPage * (tabWidth + tabSpacing);
        
        try {
            guiRef.removeComponent(20);
            guiRef.removeComponent(21);
            guiRef.removeComponent(22);
            guiRef.removeComponent(23);
        } catch(e) {}
        
        try {
            guiRef.addColoredLine(20, highlightTabX - 1, tabY - 1, highlightTabX + tabWidth + 1, tabY - 1, 0xFFFF00, 2);
            guiRef.addColoredLine(21, highlightTabX - 1, tabY + tabHeight + 1, highlightTabX + tabWidth + 1, tabY + tabHeight + 1, 0xFFFF00, 2);
            guiRef.addColoredLine(22, highlightTabX - 1, tabY - 1, highlightTabX - 1, tabY + tabHeight + 1, 0xFFFF00, 2);
            guiRef.addColoredLine(23, highlightTabX + tabWidth + 1, tabY - 1, highlightTabX + tabWidth + 1, tabY + tabHeight + 1, 0xFFFF00, 2);
        } catch(e) {}
    }
    
    updateVisibleSlots(player, api);
    updateScrollIndicator();
    
    if(guiRef){
        guiRef.update();
    }
}

function updateScrollIndicator(){
    if(!guiRef) return;
    var maxViewportRow = Math.max(0, totalRows - viewportRows);
    try {
        guiRef.removeComponent(10);
        var scrollX = startX + (numCols * colSpacing) + 2;
        var scrollY = startY;
        guiRef.addLabel(10, "§7" + (viewportRow + 1) + "/" + (maxViewportRow + 1), scrollX + 1, scrollY + 42, 0.7, 0.7);
    } catch(e) {}
}

function updateVisibleSlots(player, api){
    for(var i = 0; i < mySlots.length; i++){
        mySlots[i].setStack(null);
        var globalIndex = viewportToGlobal(i);
        
        if(globalIndex < storedSlotItems[currentPage].length && storedSlotItems[currentPage][globalIndex]) {
            try {
                var item = player.world.createItemFromNbt(api.stringToNbt(storedSlotItems[currentPage][globalIndex]));
                mySlots[i].setStack(item);
            } catch(e) {}
        }
    }
}

function customGuiButton(event){
    var player = event.player;
    var api = event.API;
    var maxViewportRow = Math.max(0, totalRows - viewportRows);
    
    // Scroll buttons
    if(event.buttonId === ID_SCROLL_UP){
        if(viewportRow > 0){
            savePageItems();
            viewportRow--;
            updateVisibleSlots(player, api);
            updateScrollIndicator();
            if(guiRef) guiRef.update();
        }
        return;
    }
    
    if(event.buttonId === ID_SCROLL_DOWN){
        if(viewportRow < maxViewportRow){
            savePageItems();
            viewportRow++;
            updateVisibleSlots(player, api);
            updateScrollIndicator();
            if(guiRef) guiRef.update();
        }
        return;
    }
    
    // Tab buttons
    if(event.buttonId >= ID_TAB_BASE && event.buttonId < ID_TAB_BASE + maxPages){
        var tabIndex = event.buttonId - ID_TAB_BASE;
        highlightedSlot = tabSlots[tabIndex];
        
        if(tabIndex !== currentPage){
            savePageItems();
            saveTabItems();
            currentPage = tabIndex;
            viewportRow = 0;
            interact({player: player, API: api, npc: lastNpc});
        }
        return;
    }
    
    // Set Rows button
    if(event.buttonId === ID_SET_ROWS_BUTTON){
        var rowsField = event.gui.getComponent(ID_ROWS_FIELD);
        if(!rowsField) return;
        
        var inputText = rowsField.getText().trim();
        if(!inputText) {
            player.message("§cPlease enter a number!");
            return;
        }
        
        var newRows = parseInt(inputText);
        if(isNaN(newRows) || newRows < 1 || newRows > 100) {
            player.message("§cInvalid! Enter a number between 1 and 100.");
            return;
        }
        
        savePageItems();
        totalRows = newRows;
        
        if(lastNpc) {
            var npcData = lastNpc.getStoreddata();
            saveTabRowConfig(npcData, totalRows);
        }
        
        var maxViewportRow = Math.max(0, totalRows - viewportRows);
        if(viewportRow > maxViewportRow) {
            viewportRow = maxViewportRow;
        }
        
        player.message("§aSet total rows to §e" + totalRows + " §afor this tab!");
        interact({player: player, API: api, npc: lastNpc});
        return;
    }
    
    // Add Tab button
    if(event.buttonId === ID_ADD_TAB){
        if(maxPages >= 10){
            player.message("§cMaximum 10 tabs allowed!");
            return;
        }
        
        savePageItems();
        saveTabItems();
        
        maxPages++;
        if(lastNpc){
            var npcData = lastNpc.getStoreddata();
            saveMaxPages(npcData, maxPages);
        }
        
        player.message("§aAdded tab! Total tabs: §e" + maxPages);
        
        highlightedSlot = null;
        highlightLineIds = [];
        guiRef = null;
        viewportRow = 0;
        currentPage = 0;
        skipSaveOnClose = true;
        
        event.gui.close();
        return;
    }
    
    // Remove Tab button
    if(event.buttonId === ID_REMOVE_TAB){
        if(maxPages <= 1){
            player.message("§cMust have at least 1 tab!");
            return;
        }
        
        var tabToDelete = currentPage;
        
        if(lastNpc){
            var npcData = lastNpc.getStoreddata();
            
            var allItems = {};
            if(npcData.has("MenuItems")){
                try {
                    allItems = JSON.parse(npcData.get("MenuItems"));
                } catch(e) {}
            }
            
            // Clean up ghost tabs
            for(var key in allItems){
                if(allItems.hasOwnProperty(key)){
                    var tabIndex = parseInt(key);
                    if(tabIndex >= maxPages){
                        delete allItems[key];
                    }
                }
            }
            
            // Save current viewport
            var totalSlots = totalRows * numCols;
            if(!allItems[currentPage]){
                allItems[currentPage] = makeNullArray(totalSlots);
            }
            
            if(mySlots && mySlots.length > 0){
                for(var i = 0; i < mySlots.length; i++){
                    var globalIndex = viewportToGlobal(i);
                    var stack = mySlots[i].getStack();
                    allItems[currentPage][globalIndex] = stack && !stack.isEmpty() ? stack.getItemNbt().toJsonString() : null;
                }
            }
            
            // Rebuild without deleted tab
            var newAllItems = {};
            var newIndex = 0;
            for(var oldIndex = 0; oldIndex < maxPages; oldIndex++){
                if(oldIndex !== tabToDelete){
                    if(allItems[oldIndex]){
                        newAllItems[newIndex] = allItems[oldIndex];
                    }
                    newIndex++;
                }
            }
            
            var freshNpcData = lastNpc.getStoreddata();
            freshNpcData.put("MenuItems", JSON.stringify(newAllItems));
            
            // Handle tab items
            var allTabItems = [];
            if(npcData.has("TabItems")){
                try {
                    allTabItems = JSON.parse(npcData.get("TabItems"));
                } catch(e) {
                    allTabItems = makeNullArray(maxPages);
                }
            } else {
                allTabItems = makeNullArray(maxPages);
            }
            
            var newTabItems = [];
            for(var oldIndex = 0; oldIndex < maxPages; oldIndex++){
                if(oldIndex !== tabToDelete){
                    newTabItems.push(allTabItems[oldIndex] || null);
                }
            }
            freshNpcData.put("TabItems", JSON.stringify(newTabItems));
            
            // Handle row configs
            if(freshNpcData.has("TabRows")){
                try {
                    var tabRowsConfig = JSON.parse(npcData.get("TabRows"));
                    var newRowsConfig = {};
                    newIndex = 0;
                    for(var oldIndex = 0; oldIndex < maxPages; oldIndex++){
                        if(oldIndex !== tabToDelete){
                            if(tabRowsConfig[oldIndex] !== undefined){
                                newRowsConfig[newIndex] = tabRowsConfig[oldIndex];
                            }
                            newIndex++;
                        }
                    }
                    freshNpcData.put("TabRows", JSON.stringify(newRowsConfig));
                } catch(e) {}
            }
        }
        
        maxPages--;
        
        if(tabToDelete < currentPage){
            currentPage--;
        } else if(currentPage >= maxPages){
            currentPage = maxPages - 1;
        }
        
        if(lastNpc){
            var saveNpcData = lastNpc.getStoreddata();
            saveMaxPages(saveNpcData, maxPages);
        }
        
        player.message("§aDeleted tab §e" + (tabToDelete + 1) + "§a! Total tabs: §e" + maxPages);
        
        highlightedSlot = null;
        highlightLineIds = [];
        guiRef = null;
        viewportRow = 0;
        currentPage = 0;
        skipSaveOnClose = true;
        
        event.gui.close();
        return;
    }
    
    if(event.buttonId !== ID_SET_PRICE_BUTTON) return;
    
    var priceField = event.gui.getComponent(ID_PRICE_FIELD);
    if(!priceField) return;
    
    var inputText = priceField.getText().trim();
    if(!inputText) {
        player.message("§cPlease enter a price!");
        return;
    }
    
    // Check if highlighting a tab slot
    var tabSlotIndex = tabSlots.indexOf(highlightedSlot);
    if(tabSlotIndex !== -1){
        var tabItem = highlightedSlot.getStack();
        if(!tabItem || tabItem.isEmpty()){
            player.message("§cNo item in selected tab slot!");
            return;
        }
        tabItem.setCustomName(inputText);
        highlightedSlot.setStack(tabItem);
        player.message("§aRenamed tab to: " + inputText);
        saveTabItems();
        return;
    }
    
    if(!highlightedSlot) {
        player.message("§cPlease select a slot first!");
        return;
    }
    
    var item = highlightedSlot.getStack();
    if(!item || item.isEmpty()) {
        player.message("§cNo item in selected slot!");
        return;
    }
    
    // Parse price as number for coin system
    var price = parseFloat(inputText);
    if(isNaN(price) || price < 0) {
        player.message("§cInvalid price! Use a number (e.g., 100 for 100¢).");
        return;
    }
    
    var priceValue = Math.floor(price);
    
    // Set price in lore with ¢ symbol
    var existingLore = item.getLore();
    var loreArray = [];
    
    // Keep existing lore except price lines
    for(var j = 0; j < existingLore.length; j++){
        var line = existingLore[j];
        if(line.indexOf("Price:") === -1){
            loreArray.push(line);
        }
    }
    
    // Remove trailing empty lines
    while(loreArray.length > 0 && loreArray[loreArray.length - 1] === ""){
        loreArray.pop();
    }
    
    // Add price with ¢ symbol
    loreArray.push("");
    loreArray.push("§aPrice: §e" + priceValue + "¢");
    
    item.setLore(loreArray);
    highlightedSlot.setStack(item);
    
    player.message("§aSet price §e" + priceValue + "¢ §afor item!");
    
    savePageItems();
    saveToGlobalData();
    
    // Debug: Show what we're trying to save
    var itemsWithPrices = 0;
    var totalItems = 0;
    for(var pageKey in storedSlotItems){
        if(storedSlotItems.hasOwnProperty(pageKey)){
            var pageItems = storedSlotItems[pageKey];
            if(Array.isArray(pageItems)){
                for(var i = 0; i < pageItems.length; i++){
                    if(pageItems[i]){
                        totalItems++;
                        try {
                            var cleanNbt = pageItems[i].replace(/(\d+)(d|b|s|f|L)\b/g, '$1');
                            var nbtObj = JSON.parse(cleanNbt);
                            if(nbtObj.tag && nbtObj.tag.display && nbtObj.tag.display.Lore){
                                var lore = nbtObj.tag.display.Lore;
                                if(Array.isArray(lore)){
                                    for(var j = 0; j < lore.length; j++){
                                        var line = String(lore[j]).replace(/§./g, "").replace(/["']/g, "");
                                        if(line.indexOf("Price:") !== -1){
                                            itemsWithPrices++;
                                            break;
                                        }
                                    }
                                }
                            }
                        } catch(e) {
                            player.message("§c[Debug] Parse error: " + e);
                        }
                    }
                }
            }
        }
    }
    
    player.message("§7[Debug] Found " + totalItems + " total items, " + itemsWithPrices + " with prices");
    
    // Debug: confirm save
    var world = lastNpc.getWorld();
    var worldData = world.getStoreddata();
    if(worldData.has("GlobalMenuData")){
        try {
            var testData = JSON.parse(worldData.get("GlobalMenuData"));
            var count = Object.keys(testData).length;
            player.message("§7[Debug] Global menu now has " + count + " items");
        } catch(e) {
            player.message("§c[Debug] Error reading global menu: " + e);
        }
    } else {
        player.message("§c[Debug] GlobalMenuData not found in world storage!");
    }
}

function customGuiSlotClicked(event) {
    var clickedSlot = event.slot;
    var stack = event.stack;
    var player = event.player;
    var api = event.API;
    
    var slotIndex = mySlots.indexOf(clickedSlot);
    
    // Check if clicking a tab slot
    var clickedTabIndex = -1;
    for(var i = 0; i < tabSlots.length; i++){
        if(tabSlots[i] === clickedSlot){
            clickedTabIndex = i;
            break;
        }
    }
    
    if(clickedTabIndex !== -1) {
        highlightedSlot = clickedSlot;
        if(guiRef) guiRef.update();
        return;
    }
    
    // Handle menu slot clicks
    if(slotIndex !== -1) {
        if(!guiRef) return;
        
        highlightedSlot = clickedSlot;
        
        for(var i=0; i<highlightLineIds.length; i++){
            try { guiRef.removeComponent(highlightLineIds[i]); } catch(e) {}
        }
        highlightLineIds = [];
        
        var pos = slotPositions[slotIndex];
        var x = pos.x, y = pos.y, w = 18, h = 18;
        
        highlightLineIds.push(guiRef.addColoredLine(1, x, y, x+w, y, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(2, x, y+h, x+w, y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(3, x, y, x, y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(4, x+w, y, x+w, y+h, 0xADD8E6, 2));
        
        if(guiRef) guiRef.update();
        return;
    }
    
    if(!highlightedSlot) return;
    
    // Check if highlighted slot is a tab slot
    var isTabSlot = false;
    for(var i = 0; i < tabSlots.length; i++){
        if(tabSlots[i] === highlightedSlot){
            isTabSlot = true;
            break;
        }
    }
    
    try {
        var slotStack = highlightedSlot.getStack();
        var maxStack = stack ? stack.getMaxStackSize() : 64;
        
        if(stack && !stack.isEmpty()) {
            if(slotStack && !slotStack.isEmpty() && slotStack.getDisplayName() === stack.getDisplayName()) {
                var total = slotStack.getStackSize() + stack.getStackSize();
                if(total <= maxStack) {
                    slotStack.setStackSize(total);
                    highlightedSlot.setStack(slotStack);
                    player.removeItem(stack, stack.getStackSize());
                } else {
                    var overflow = total - maxStack;
                    slotStack.setStackSize(maxStack);
                    highlightedSlot.setStack(slotStack);
                    var overflowCopy = player.world.createItemFromNbt(stack.getItemNbt());
                    overflowCopy.setStackSize(overflow);
                    player.removeItem(stack, stack.getStackSize());
                    player.giveItem(overflowCopy);
                }
            } else {
                var itemCopy = player.world.createItemFromNbt(stack.getItemNbt());
                if(slotStack && !slotStack.isEmpty()) {
                    player.giveItem(slotStack);
                }
                highlightedSlot.setStack(itemCopy);
                player.removeItem(stack, stack.getStackSize());
            }
            
            if(isTabSlot) {
                saveTabItems();
            } else {
                savePageItems();
                saveToGlobalData();
            }
        } else if(slotStack && !slotStack.isEmpty()) {
            player.giveItem(slotStack);
            highlightedSlot.setStack(player.world.createItem("minecraft:air", 1));
            
            if(isTabSlot) {
                saveTabItems();
            } else {
                savePageItems();
                saveToGlobalData();
            }
            
            if(guiRef) guiRef.update();
        }
        
        if(guiRef) guiRef.update();
    } catch(e) {
        player.message("§cError: " + e);
    }
}

function customGuiClosed(event) {
    if(!skipSaveOnClose){
        savePageItems();
        saveTabItems();
        saveToGlobalData();
    } else {
        skipSaveOnClose = false;
    }
    
    guiRef = null;
    viewportRow = 0;
    currentPage = 0;
}

function savePageItems(){
    if(!lastNpc) return;
    
    var npcData = lastNpc.getStoreddata();
    var totalSlots = totalRows * numCols;
    
    if(!storedSlotItems[currentPage] || storedSlotItems[currentPage].length !== totalSlots){
        storedSlotItems[currentPage] = makeNullArray(totalSlots);
    }
    
    for(var i = 0; i < mySlots.length; i++){
        var globalIndex = viewportToGlobal(i);
        var stack = mySlots[i].getStack();
        storedSlotItems[currentPage][globalIndex] = stack && !stack.isEmpty() ? stack.getItemNbt().toJsonString() : null;
    }
    
    npcData.put("MenuItems", JSON.stringify(storedSlotItems));
}

function saveTabItems(){
    if(!lastNpc || !tabSlots || tabSlots.length === 0) return;
    
    var npcData = lastNpc.getStoreddata();
    var tabItems = tabSlots.map(function(slot){
        var stack = slot.getStack();
        if(stack && !stack.isEmpty()){
            return stack.getItemNbt().toJsonString();
        }
        return null;
    });
    
    npcData.put("TabItems", JSON.stringify(tabItems));
}

function saveToGlobalData(){
    if(!lastNpc) return;
    
    var world = lastNpc.getWorld();
    var worldData = world.getStoreddata();
    var npcData = lastNpc.getStoreddata();
    
    // Build menu with prices from all items
    var globalMenu = {};
    
    for(var pageKey in storedSlotItems){
        if(!storedSlotItems.hasOwnProperty(pageKey)) continue;
        
        var pageItems = storedSlotItems[pageKey];
        if(!Array.isArray(pageItems)) continue;
        
        for(var i = 0; i < pageItems.length; i++){
            if(!pageItems[i]) continue;
            
            try {
                var itemNbt = pageItems[i];
                
                // Clean NBT string - remove type suffixes (d, b, s, f, L)
                var cleanNbt = itemNbt.replace(/(\d+)(d|b|s|f|L)\b/g, '$1');
                
                // Parse NBT string to get the item's lore
                var nbtObj = JSON.parse(cleanNbt);
                
                var price = null;
                
                // Check if item has display tag with Lore
                if(nbtObj.tag && nbtObj.tag.display && nbtObj.tag.display.Lore){
                    var loreArray = nbtObj.tag.display.Lore;
                    
                    // Lore can be array or object depending on format
                    if(Array.isArray(loreArray)){
                        for(var j = 0; j < loreArray.length; j++){
                            var line = String(loreArray[j]);
                            
                            // CustomNPCs uses JSON format like: {"translate":"§aPrice: §e100¢"}
                            // Try to parse as JSON first
                            try {
                                var loreJson = JSON.parse(line);
                                if(loreJson.translate){
                                    line = loreJson.translate;
                                }
                            } catch(e) {
                                // Not JSON, use as-is
                            }
                            
                            // Remove color codes and quotes
                            var cleanLine = line.replace(/§./g, "").replace(/["']/g, "");
                            if(cleanLine.indexOf("Price:") !== -1 && cleanLine.indexOf("¢") !== -1){
                                var match = cleanLine.match(/Price:\s*(\d+)/);
                                if(match && match[1]){
                                    price = parseInt(match[1]);
                                    break;
                                }
                            }
                        }
                    } else if(typeof loreArray === 'object'){
                        // Handle object format
                        for(var key in loreArray){
                            var line = String(loreArray[key]);
                            
                            // Try to parse as JSON first
                            try {
                                var loreJson = JSON.parse(line);
                                if(loreJson.translate){
                                    line = loreJson.translate;
                                }
                            } catch(e) {
                                // Not JSON, use as-is
                            }
                            
                            var cleanLine = line.replace(/§./g, "").replace(/["']/g, "");
                            if(cleanLine.indexOf("Price:") !== -1 && cleanLine.indexOf("¢") !== -1){
                                var match = cleanLine.match(/Price:\s*(\d+)/);
                                if(match && match[1]){
                                    price = parseInt(match[1]);
                                    break;
                                }
                            }
                        }
                    }
                }
                
                if(price !== null && price !== undefined){
                    // Create unique key for this item
                    var itemKey = "page" + pageKey + "_slot" + i;
                    globalMenu[itemKey] = {
                        item: itemNbt,
                        price: price
                    };
                }
            } catch(e) {
                // Log parsing errors for debugging
                if(lastNpc && lastNpc.getWorld){
                    try {
                        var nearbyPlayers = world.getNearbyEntities(lastNpc.getX(), lastNpc.getY(), lastNpc.getZ(), 10, 1);
                        if(nearbyPlayers && nearbyPlayers.length > 0){
                            nearbyPlayers[0].message("§c[Debug] Error parsing item " + i + ": " + e);
                        }
                    } catch(e2) {}
                }
            }
        }
    }
    
    worldData.put("GlobalMenuData", JSON.stringify(globalMenu));
}

function countPlayerCoins(player) {
    var stoneTotal = 0;
    var coalTotal = 0;
    var emeraldTotal = 0;
    var inv = player.getInventory();
    for(var i = 0; i < inv.getSize(); i++) {
        var stack = inv.getSlot(i);
        if(stack && !stack.isEmpty()) {
            var name = stack.getName();
            if(name === "coins:stone_coin") {
                stoneTotal += stack.getStackSize();
            } else if(name === "coins:coal_coin") {
                coalTotal += stack.getStackSize();
            } else if(name === "coins:emerald_coin") {
                emeraldTotal += stack.getStackSize();
            }
        }
    }
    return stoneTotal + (coalTotal * STONE_TO_COAL) + (emeraldTotal * STONE_TO_COAL * COAL_TO_EMERALD);
}

function removeCoins(player, amount) {
    var remaining = amount;
    var inv = player.getInventory();
    for(var i = 0; i < inv.getSize() && remaining > 0; i++) {
        var stack = inv.getSlot(i);
        if(stack && !stack.isEmpty() && stack.getName() === "coins:stone_coin") {
            var stackAmount = stack.getStackSize();
            if(stackAmount <= remaining) {
                inv.setSlot(i, null);
                remaining -= stackAmount;
            } else {
                stack.setStackSize(stackAmount - remaining);
                remaining = 0;
            }
        }
    }
    for(var i = 0; i < inv.getSize() && remaining > 0; i++) {
        var stack = inv.getSlot(i);
        if(stack && !stack.isEmpty() && stack.getName() === "coins:coal_coin") {
            var stackAmount = stack.getStackSize();
            var stoneValue = stackAmount * STONE_TO_COAL;
            if(stoneValue <= remaining) {
                inv.setSlot(i, null);
                remaining -= stoneValue;
            } else {
                var coalsNeeded = Math.ceil(remaining / STONE_TO_COAL);
                stack.setStackSize(stackAmount - coalsNeeded);
                var overpaid = (coalsNeeded * STONE_TO_COAL) - remaining;
                remaining = 0;
                if(overpaid > 0){
                    var changeItem = player.world.createItem("coins:stone_coin", overpaid);
                    player.giveItem(changeItem);
                }
            }
        }
    }
    for(var i = 0; i < inv.getSize() && remaining > 0; i++) {
        var stack = inv.getSlot(i);
        if(stack && !stack.isEmpty() && stack.getName() === "coins:emerald_coin") {
            var stackAmount = stack.getStackSize();
            var stoneValue = stackAmount * STONE_TO_COAL * COAL_TO_EMERALD;
            if(stoneValue <= remaining) {
                inv.setSlot(i, null);
                remaining -= stoneValue;
            } else {
                var emeraldsNeeded = Math.ceil(remaining / (STONE_TO_COAL * COAL_TO_EMERALD));
                stack.setStackSize(stackAmount - emeraldsNeeded);
                var overpaid = (emeraldsNeeded * STONE_TO_COAL * COAL_TO_EMERALD) - remaining;
                remaining = 0;
                if(overpaid > 0){
                    var changeCoal = Math.floor(overpaid / STONE_TO_COAL);
                    var changeStone = overpaid % STONE_TO_COAL;
                    if(changeCoal > 0){
                        var coalItem = player.world.createItem("coins:coal_coin", changeCoal);
                        player.giveItem(coalItem);
                    }
                    if(changeStone > 0){
                        var stoneItem = player.world.createItem("coins:stone_coin", changeStone);
                        player.giveItem(stoneItem);
                    }
                }
            }
        }
    }
}