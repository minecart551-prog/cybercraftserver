// HARDENED Shop NPC Script with Corruption Resistance
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

// ========== CORRUPTION RESISTANCE LAYER ==========

// Safe JSON parse with fallback
function safeJSONParse(jsonString, defaultValue) {
    if (!jsonString || jsonString.length === 0) {
        return defaultValue;
    }
    try {
        return JSON.parse(jsonString);
    } catch(e) {
        return defaultValue;
    }
}

// Safe data retrieval with validation
function safeGetData(npcData, key, defaultValue) {
    if (!npcData.has(key)) {
        return defaultValue;
    }
    var rawData = npcData.get(key);
    if (!rawData || rawData.length() === 0) {
        return defaultValue;
    }
    return rawData;
}

// Atomic save with validation - ensures data is valid before saving
function atomicSave(npcData, key, value) {
    try {
        // Validate the value can be stringified
        var jsonString = JSON.stringify(value);
        
        // Extra validation: ensure it's not empty
        if (!jsonString || jsonString.length === 0) {
            return false;
        }
        
        // Verify it can be parsed back (round-trip test)
        JSON.parse(jsonString);
        
        // Only save if all validations pass
        npcData.put(key, jsonString);
        return true;
    } catch(e) {
        return false;
    }
}

// Load data with automatic repair
function loadShopItems(npcData) {
    var rawData = safeGetData(npcData, "ShopItems", null);
    if (rawData === null) {
        // No data - initialize fresh
        var emptyData = {};
        atomicSave(npcData, "ShopItems", emptyData);
        return emptyData;
    }
    
    var parsed = safeJSONParse(rawData, null);
    if (parsed === null) {
        // Corrupted data - reinitialize
        var emptyData = {};
        atomicSave(npcData, "ShopItems", emptyData);
        return emptyData;
    }
    
    return parsed;
}

function loadTabItems(npcData, expectedLength) {
    var rawData = safeGetData(npcData, "TabItems", null);
    if (rawData === null) {
        var defaultArray = makeNullArray(expectedLength);
        atomicSave(npcData, "TabItems", defaultArray);
        return defaultArray;
    }
    
    var parsed = safeJSONParse(rawData, null);
    if (parsed === null || !Array.isArray(parsed)) {
        var defaultArray = makeNullArray(expectedLength);
        atomicSave(npcData, "TabItems", defaultArray);
        return defaultArray;
    }
    
    // Ensure correct length
    while (parsed.length < expectedLength) {
        parsed.push(null);
    }
    if (parsed.length > expectedLength) {
        parsed = parsed.slice(0, expectedLength);
    }
    
    return parsed;
}

function loadTabRows(npcData, currentPage) {
    var rawData = safeGetData(npcData, "TabRows", null);
    if (rawData === null) {
        return 20; // Default
    }
    
    var parsed = safeJSONParse(rawData, {});
    if (parsed[currentPage] !== undefined) {
        return parsed[currentPage];
    }
    return 20; // Default
}

function saveTabRowConfig(npcData, rows) {
    var rawData = safeGetData(npcData, "TabRows", null);
    var tabRowsConfig = safeJSONParse(rawData, {});
    
    tabRowsConfig[currentPage] = rows;
    atomicSave(npcData, "TabRows", tabRowsConfig);
}

// ========== END CORRUPTION RESISTANCE LAYER ==========

function makeNullArray(n){
    var a = new Array(n);
    for (var i = 0; i < n; i++){ a[i] = null; }
    return a;
}

// Load total rows for current tab
function loadTabRowConfig(npcData) {
    totalRows = loadTabRows(npcData, currentPage);
}

// Load max pages
function loadMaxPages(npcData) {
    if(npcData.has("MaxPages")) {
        try {
            maxPages = parseInt(npcData.get("MaxPages"));
            if(isNaN(maxPages) || maxPages < 1) maxPages = 1;
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
    npcData.put("MaxPages", "" + pages);
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
    
    // Load max pages
    loadMaxPages(npcData);
    
    // Load row configuration for this tab
    loadTabRowConfig(npcData);
    
    // Load shop items with corruption protection
    storedSlotItems = loadShopItems(npcData);
    
    var adminMode = (player.getMainhandItem() && player.getMainhandItem().getName() === "minecraft:bedrock");
    
    // CLEANUP: Remove any ghost tabs beyond maxPages
    for(var key in storedSlotItems){
        if(storedSlotItems.hasOwnProperty(key)){
            var tabIndex = parseInt(key);
            if(tabIndex >= maxPages){
                delete storedSlotItems[key];
            }
        }
    }
    
    // Load tab items with corruption protection
    var storedTabItems = loadTabItems(npcData, maxPages);
    
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
        // Scroll buttons on the right side
        var scrollX = startX + (numCols * colSpacing) + 2;
        var scrollY = startY;
        guiRef.addButton(ID_SCROLL_UP, "↑", scrollX, scrollY, 18, 18);
        guiRef.addButton(ID_SCROLL_DOWN, "↓", scrollX, scrollY + 20, 18, 18);
        // Scroll position indicator
        guiRef.addLabel(10, "", scrollX + 1, scrollY + 42, 0.7, 0.7);
        if(adminMode){
            // Price/Name section
            guiRef.addLabel(3, "§7Price/Name:", 2, -100, 0.8, 0.8);
            guiRef.addTextField(ID_PRICE_FIELD, 60, -104, 60, 18).setText("");
            guiRef.addButton(ID_SET_PRICE_BUTTON, "Set", 125, -104, 35, 18);
            // Tab management buttons
            var tabManageX = (maxPages * 27) + 2;
            guiRef.addButton(ID_ADD_TAB, "+", tabManageX, -80, 16, 14);
            guiRef.addButton(ID_REMOVE_TAB, "-", tabManageX + 18, -80, 16, 14);
            guiRef.addLabel(7, "§7Tabs", tabManageX - 8, -92, 0.7, 0.7);
            // Admin Shop Editor
            guiRef.addLabel(1, "§6Admin Shop Editor", 2, 63, 1.0, 1.0);
            // Rows configuration
            guiRef.addLabel(6, "§7Total Rows:", -105, -29, 0.8, 0.8);
            guiRef.addTextField(ID_ROWS_FIELD, -105, -17, 40, 18).setText("" + totalRows);
            guiRef.addButton(ID_SET_ROWS_BUTTON, "Set", -60, -17, 30, 18);
            guiRef.showPlayerInventory(3, 91, false);
        }
        // Load tab items BEFORE showing GUI
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
        // GUI already exists, just reload tab items
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
    // Add highlight around current tab in admin mode
    if(adminMode && guiRef && currentPage < maxPages){
        var tabWidth = 25;
        var tabHeight = 28;
        var tabSpacing = 2;
        var tabStartX = 0;
        var tabY = -80;
        var highlightTabX = tabStartX + currentPage * (tabWidth + tabSpacing);
        // Remove old highlight if exists
        try {
            guiRef.removeComponent(20);
            guiRef.removeComponent(21);
            guiRef.removeComponent(22);
            guiRef.removeComponent(23);
        } catch(e) {}
        try {
            // Draw highlight box around current tab
            guiRef.addColoredLine(20, highlightTabX - 1, tabY - 1, highlightTabX + tabWidth + 1, tabY - 1, 0xFFFF00, 2);
            guiRef.addColoredLine(21, highlightTabX - 1, tabY + tabHeight + 1, highlightTabX + tabWidth + 1, tabY + tabHeight + 1, 0xFFFF00, 2);
            guiRef.addColoredLine(22, highlightTabX - 1, tabY - 1, highlightTabX - 1, tabY + tabHeight + 1, 0xFFFF00, 2);
            guiRef.addColoredLine(23, highlightTabX + tabWidth + 1, tabY - 1, highlightTabX + tabWidth + 1, tabY + tabHeight + 1, 0xFFFF00, 2);
        } catch(e) {}
    }
    updateVisibleSlots(player, api, adminMode);
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

function updateVisibleSlots(player, api, adminMode){
    for(var i = 0; i < mySlots.length; i++){
        mySlots[i].setStack(null);
        var globalIndex = viewportToGlobal(i);
        if(globalIndex < storedSlotItems[currentPage].length && storedSlotItems[currentPage][globalIndex]) {
            try {
                var item = player.world.createItemFromNbt(api.stringToNbt(storedSlotItems[currentPage][globalIndex]));
                var price = null;
                var lore = item.getLore();
                for(var j = 0; j < lore.length; j++){
                    var line = lore[j];
                    if(line.indexOf("Price:") !== -1 && line.indexOf("¢") !== -1){
                        var priceStr = line.replace(/§./g, "");
                        var match = priceStr.match(/Price:\s*(\d+)¢/);
                        if(match && match[1]){
                            price = parseInt(match[1]);
                            break;
                        }
                    }
                }
                if(price !== null && price !== undefined){
                    var existingLore = item.getLore();
                    var loreArray = [];
                    for(var j = 0; j < existingLore.length; j++){
                        var line = existingLore[j];
                        if(line.indexOf("Price:") === -1 && line.indexOf("Click to purchase") === -1){
                            loreArray.push(line);
                        }
                    }
                    while(loreArray.length > 0 && loreArray[loreArray.length - 1] === ""){
                        loreArray.pop();
                    }
                    loreArray.push("");
                    loreArray.push("§aPrice: §e" + price + "¢");
                    if(!adminMode){
                        loreArray.push("§7Click to purchase");
                    }
                    item.setLore(loreArray);
                }
                mySlots[i].setStack(item);
            } catch(e) {}
        }
    }
}

function customGuiButton(event){
    var player = event.player;
    var api = event.API;
    var adminMode = (player.getMainhandItem() && player.getMainhandItem().getName() === "minecraft:bedrock");
    var maxViewportRow = Math.max(0, totalRows - viewportRows);
    
    // Scroll buttons
    if(event.buttonId === ID_SCROLL_UP){
        if(viewportRow > 0){
            savePageItems();
            viewportRow--;
            updateVisibleSlots(player, api, adminMode);
            updateScrollIndicator();
            if(guiRef) guiRef.update();
        }
        return;
    }
    if(event.buttonId === ID_SCROLL_DOWN){
        if(viewportRow < maxViewportRow){
            savePageItems();
            viewportRow++;
            updateVisibleSlots(player, api, adminMode);
            updateScrollIndicator();
            if(guiRef) guiRef.update();
        }
        return;
    }
    
    // Tab buttons
    if(event.buttonId >= ID_TAB_BASE && event.buttonId < ID_TAB_BASE + maxPages){
        var tabIndex = event.buttonId - ID_TAB_BASE;
        if(adminMode){
            highlightedSlot = tabSlots[tabIndex];
        }
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
        if(!adminMode) return;
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
        
        // Save current viewport items FIRST
        savePageItems();
        
        // Load ALL existing items from storage to preserve them
        if(lastNpc) {
            var npcData = lastNpc.getStoreddata();
            var allItems = loadShopItems(npcData);
            
            // Get old array for current page
            var oldArray = allItems[currentPage] || [];
            var newTotalSlots = newRows * numCols;
            
            // Create new array with new size
            var newArray = makeNullArray(newTotalSlots);
            
            // Copy over existing items
            var copyLimit = Math.min(oldArray.length, newTotalSlots);
            for(var i = 0; i < copyLimit; i++){
                newArray[i] = oldArray[i];
            }
            
            // Update storage with resized array
            allItems[currentPage] = newArray;
            storedSlotItems = allItems;
            
            // Save back to NPC using atomic save
            atomicSave(npcData, "ShopItems", allItems);
            
            // Update total rows
            totalRows = newRows;
            
            // Save row config
            saveTabRowConfig(npcData, totalRows);
        }
        
        // Reset viewport if out of bounds
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
        if(!adminMode) return;
        if(maxPages >= 10){
            player.message("§cMaximum 10 tabs allowed!");
            return;
        }
        
        // Save current state with atomic protection
        if(lastNpc && mySlots && mySlots.length > 0){
            var npcData = lastNpc.getStoreddata();
            var allItems = loadShopItems(npcData);
            
            // Ensure current page array exists
            var totalSlots = totalRows * numCols;
            if(!allItems[currentPage]){
                allItems[currentPage] = makeNullArray(totalSlots);
            }
            
            // Save visible viewport items
            for(var i = 0; i < mySlots.length; i++){
                var globalIndex = viewportToGlobal(i);
                var stack = mySlots[i].getStack();
                allItems[currentPage][globalIndex] = stack && !stack.isEmpty() ? stack.getItemNbt().toJsonString() : null;
            }
            
            // Atomic save
            if(!atomicSave(npcData, "ShopItems", allItems)){
                player.message("§cFailed to save shop data!");
                return;
            }
            
            // Save tab items
            if(tabSlots && tabSlots.length > 0){
                var tabItems = tabSlots.map(function(slot){
                    var stack = slot.getStack();
                    return (stack && !stack.isEmpty()) ? stack.getItemNbt().toJsonString() : null;
                });
                atomicSave(npcData, "TabItems", tabItems);
            }
        }
        
        // Increment maxPages
        maxPages++;
        if(lastNpc){
            var npcData = lastNpc.getStoreddata();
            saveMaxPages(npcData, maxPages);
        }
        
        player.message("§aAdded tab! Total tabs: §e" + maxPages);
        
        // Reset and close
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
        if(!adminMode) return;
        if(maxPages <= 1){
            player.message("§cMust have at least 1 tab!");
            return;
        }
        
        var tabToDelete = currentPage;
        if(lastNpc){
            var npcData = lastNpc.getStoreddata();
            var allItems = loadShopItems(npcData);
            
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
            
            // Create new items object, skipping deleted tab
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
            
            // Atomic save
            var freshNpcData = lastNpc.getStoreddata();
            if(!atomicSave(freshNpcData, "ShopItems", newAllItems)){
                player.message("§cFailed to save shop data!");
                return;
            }
            
            // Handle tab items
            var allTabItems = loadTabItems(npcData, maxPages);
            var newTabItems = [];
            for(var oldIndex = 0; oldIndex < maxPages; oldIndex++){
                if(oldIndex !== tabToDelete){
                    newTabItems.push(allTabItems[oldIndex] || null);
                }
            }
            atomicSave(freshNpcData, "TabItems", newTabItems);
            
            // Handle row configs
            var rawTabRows = safeGetData(freshNpcData, "TabRows", null);
            var tabRowsConfig = safeJSONParse(rawTabRows, {});
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
            atomicSave(freshNpcData, "TabRows", newRowsConfig);
        }
        
        // Decrement maxPages
        maxPages--;
        
        // Adjust currentPage
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
        
        // Reset and close
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
    if(!adminMode) return;
    var priceField = event.gui.getComponent(ID_PRICE_FIELD);
    if(!priceField) return;
    var inputText = priceField.getText().trim();
    if(!inputText) {
        player.message("§cPlease enter a value!");
        return;
    }
    
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
    var price = parseFloat(inputText);
    if(isNaN(price) || price < 0) {
        player.message("§cInvalid price! Use a number.");
        return;
    }
    var item = highlightedSlot.getStack();
    if(!item || item.isEmpty()) {
        player.message("§cNo item in selected slot!");
        return;
    }
    var priceValue = Math.floor(price);
    var existingLore = item.getLore();
    var loreArray = [];
    for(var j = 0; j < existingLore.length; j++){
        var line = existingLore[j];
        if(line.indexOf("Price:") === -1 && line.indexOf("Click to purchase") === -1){
            loreArray.push(line);
        }
    }
    while(loreArray.length > 0 && loreArray[loreArray.length - 1] === ""){
        loreArray.pop();
    }
    loreArray.push("");
    loreArray.push("§aPrice: §e" + priceValue + "¢");
    item.setLore(loreArray);
    highlightedSlot.setStack(item);
    player.message("§aSet price §e" + priceValue + "¢ §afor item!");
    savePageItems();
}

function customGuiSlotClicked(event) {
    var clickedSlot = event.slot;
    var stack = event.stack;
    var player = event.player;
    var api = event.API;
    var adminMode = (player.getMainhandItem() && player.getMainhandItem().getName() === "minecraft:bedrock");
    var slotIndex = mySlots.indexOf(clickedSlot);
    
    if(adminMode) {
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
                }
            } else if(slotStack && !slotStack.isEmpty()) {
                player.giveItem(slotStack);
                highlightedSlot.setStack(player.world.createItem("minecraft:air", 1));
                if(isTabSlot) {
                    saveTabItems();
                } else {
                    savePageItems();
                }
                if(guiRef) guiRef.update();
            }
            if(guiRef) guiRef.update();
        } catch(e) {
            player.message("§cError: " + e);
        }
    } else {
        if(slotIndex === -1) return;
        var globalIndex = viewportToGlobal(slotIndex);
        if(globalIndex >= storedSlotItems[currentPage].length) return;
        var item = mySlots[slotIndex].getStack();
        if(!item || item.isEmpty()) return;
        
        var price = null;
        var lore = item.getLore();
        for(var i = 0; i < lore.length; i++){
            var line = lore[i];
            if(line.indexOf("Price:") !== -1 && line.indexOf("¢") !== -1){
                var priceStr = line.replace(/§./g, "");
                var match = priceStr.match(/Price:\s*(\d+)¢/);
                if(match && match[1]){
                    price = parseInt(match[1]);
                    break;
                }
            }
        }
        if(price === null || price === undefined) {
            player.message("§cThis item has no price set!");
            return;
        }
        
        var playerCoins = countPlayerCoins(player);
        if(playerCoins < price) {
            player.message("§cNot enough coins! Need: §e" + price + "¢ §c, Have: §e" + playerCoins + "¢");
            return;
        }
        
        removeCoins(player, price);
        
        try {
            if(storedSlotItems[currentPage][globalIndex]) {
                var purchaseItem = player.world.createItemFromNbt(api.stringToNbt(storedSlotItems[currentPage][globalIndex]));
                var purchaseLore = purchaseItem.getLore();
                var cleanLore = [];
                for(var i = 0; i < purchaseLore.length; i++){
                    var line = purchaseLore[i];
                    if(line.indexOf("Price:") === -1 && line.indexOf("Click to purchase") === -1){
                        cleanLore.push(line);
                    }
                }
                while(cleanLore.length > 0 && cleanLore[cleanLore.length - 1] === ""){
                    cleanLore.pop();
                }
                purchaseItem.setLore(cleanLore);
                player.giveItem(purchaseItem);
                player.message("§aPurchased item for §e" + price + "¢!");
            }
        } catch(e) {
            player.message("§cError purchasing item: " + e);
        }
    }
}

function customGuiClosed(event) {
    if(!skipSaveOnClose){
        savePageItems();
        saveTabItems();
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
    
    // Use atomic save
    atomicSave(npcData, "ShopItems", storedSlotItems);
}

function saveTabItems(){
    if(!lastNpc || !tabSlots || tabSlots.length === 0) return;
    var npcData = lastNpc.getStoreddata();
    
    var tabItems = tabSlots.map(function(slot){
        var stack = slot.getStack();
        return (stack && !stack.isEmpty()) ? stack.getItemNbt().toJsonString() : null;
    });
    
    // Use atomic save
    atomicSave(npcData, "TabItems", tabItems);
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