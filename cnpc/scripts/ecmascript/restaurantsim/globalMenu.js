// ================================================================
// Menu Editor NPC Script
// ONLY reads/writes "GlobalMenuData" in world storage.
// Format: { "page0_slot3": {item: nbtString, price: 8}, ... }
// Tab icons are stored as page X, slot -1: { tabIcon: nbtString }
// maxPages and totalRows are derived from the data itself.
// Place in: Interact, customGuiButton, customGuiSlotClicked, customGuiClosed
// ================================================================

function safeJSONParse(str, fallback) {
    if (!str || str.length === 0) return fallback;
    try { return JSON.parse(str); } catch(e) { return fallback; }
}

function atomicSave(storageData, key, value) {
    try {
        var json = JSON.stringify(value);
        if (!json || json.length === 0) return false;
        JSON.parse(json);
        storageData.put(key, json);
        return true;
    } catch(e) { return false; }
}

// ========== State ==========

var guiRef           = null;
var mySlots          = [];
var tabSlots         = [];
var highlightLineIds = [];
var highlightedSlot  = null;
var lastNpc          = null;
var skipSaveOnClose  = false;

var globalMenuData = {};
var maxPages       = 1;
var currentPage    = 0;
var viewportRow    = 0;
var viewportRows   = 6;
var totalRows      = 20;
var numCols        = 9;

// Component IDs
var ID_PRICE_FIELD      = 100;
var ID_SET_PRICE_BUTTON = 101;
var ID_TAB_BASE         = 102;
var ID_SCROLL_UP        = 111;
var ID_SCROLL_DOWN      = 112;
var ID_ROWS_FIELD       = 115;
var ID_SET_ROWS_BUTTON  = 116;
var ID_ADD_TAB          = 117;
var ID_REMOVE_TAB       = 118;

// Layout
var slotPositions = [];
var startX = 0, startY = -50, rowSpacing = 18, colSpacing = 18;
for (var _r = 0; _r < viewportRows; _r++) {
    for (var _c = 0; _c < numCols; _c++) {
        slotPositions.push({ x: startX + _c * colSpacing, y: startY + _r * rowSpacing });
    }
}

// ========== Data helpers ==========

function slotKey(page, idx)    { return "page" + page + "_slot" + idx; }
function tabIconKey(page)      { return "page" + page + "_tabicon"; }

function getSlot(page, idx)    { return globalMenuData[slotKey(page, idx)] || null; }
function setSlot(page, idx, nbt, price) {
    if (nbt) { globalMenuData[slotKey(page, idx)] = { item: nbt, price: price }; }
    else      { delete globalMenuData[slotKey(page, idx)]; }
}

function getTabIcon(page)      { return globalMenuData[tabIconKey(page)] || null; }
function setTabIcon(page, nbt) {
    if (nbt) { globalMenuData[tabIconKey(page)] = { tabIcon: nbt }; }
    else      { delete globalMenuData[tabIconKey(page)]; }
}

// Scan GlobalMenuData to find how many pages exist
function deriveMaxPages(data) {
    var max = 0;
    for (var key in data) {
        if (!data.hasOwnProperty(key)) continue;
        var m = key.match(/^page(\d+)_/);
        if (m) {
            var pg = parseInt(m[1]);
            if (pg > max) max = pg;
        }
    }
    return max + 1;
}

// Scan GlobalMenuData to find highest slot index for a page -> total rows
function derivePageRows(data, page) {
    var maxSlot = -1;
    var prefix  = "page" + page + "_slot";
    for (var key in data) {
        if (!data.hasOwnProperty(key)) continue;
        if (key.indexOf(prefix) !== 0) continue;
        var idx = parseInt(key.substring(prefix.length));
        if (!isNaN(idx) && idx > maxSlot) maxSlot = idx;
    }
    if (maxSlot < 0) return 20; // default
    return Math.ceil((maxSlot + 1) / numCols);
}

// Extract price from item NBT lore
function extractPrice(nbt) {
    if (!nbt) return null;
    try {
        var clean  = nbt.replace(/(\d+)(d|b|s|f|L)\b/g, '$1');
        var obj    = safeJSONParse(clean, null);
        if (!obj || !obj.tag || !obj.tag.display || !obj.tag.display.Lore) return null;
        var lore   = obj.tag.display.Lore;
        var list   = Array.isArray(lore) ? lore : (function(){ var a=[]; for(var k in lore) a.push(lore[k]); return a; })();
        for (var j = 0; j < list.length; j++) {
            var line = String(list[j]);
            var lj   = safeJSONParse(line, null);
            if (lj && lj.translate) line = lj.translate;
            var cl = line.replace(/§./g, "").replace(/["']/g, "");
            if (cl.indexOf("Price:") !== -1 && cl.indexOf("¢") !== -1) {
                var m = cl.match(/Price:\s*(\d+)/);
                if (m) return parseInt(m[1]);
            }
        }
    } catch(e) {}
    return null;
}

// ========== World load/save ==========

function loadFromWorld(worldData) {
    if (worldData.has("GlobalMenuData")) {
        globalMenuData = safeJSONParse("" + worldData.get("GlobalMenuData"), {});
    } else {
        globalMenuData = {};
    }
}

function saveToWorld(worldData) {
    atomicSave(worldData, "GlobalMenuData", globalMenuData);
}

// ========== Viewport ==========

function viewportToGlobal(i) {
    return (viewportRow + Math.floor(i / numCols)) * numCols + (i % numCols);
}

function updateVisibleSlots(player, api) {
    for (var i = 0; i < mySlots.length; i++) {
        mySlots[i].setStack(null);
        var entry = getSlot(currentPage, viewportToGlobal(i));
        if (entry && entry.item) {
            try { mySlots[i].setStack(player.world.createItemFromNbt(api.stringToNbt(entry.item))); } catch(e) {}
        }
    }
}

function updateScrollIndicator() {
    if (!guiRef) return;
    var scrollX = startX + (numCols * colSpacing) + 2;
    try { guiRef.removeComponent(10); } catch(e) {}
    guiRef.addLabel(10, "§7" + (viewportRow+1) + "/" + Math.max(1, totalRows - viewportRows + 1), scrollX+1, startY+42, 0.7, 0.7);
}

function highlightActiveTab() {
    if (!guiRef) return;
    try { guiRef.removeComponent(20); guiRef.removeComponent(21); guiRef.removeComponent(22); guiRef.removeComponent(23); } catch(e) {}
    var tw=25, th=28, ts=2, ty=-80, hx=currentPage*(tw+ts);
    try {
        guiRef.addColoredLine(20, hx-1,    ty-1,    hx+tw+1, ty-1,    0xFFFF00, 2);
        guiRef.addColoredLine(21, hx-1,    ty+th+1, hx+tw+1, ty+th+1, 0xFFFF00, 2);
        guiRef.addColoredLine(22, hx-1,    ty-1,    hx-1,    ty+th+1, 0xFFFF00, 2);
        guiRef.addColoredLine(23, hx+tw+1, ty-1,    hx+tw+1, ty+th+1, 0xFFFF00, 2);
    } catch(e) {}
}

function flushVisibleSlots() {
    for (var i = 0; i < mySlots.length; i++) {
        var gi    = viewportToGlobal(i);
        var stack = mySlots[i].getStack();
        if (stack && !stack.isEmpty()) {
            var nbt = stack.getItemNbt().toJsonString();
            setSlot(currentPage, gi, nbt, extractPrice(nbt));
        } else {
            setSlot(currentPage, gi, null, null);
        }
    }
}

function flushTabIcons() {
    for (var i = 0; i < tabSlots.length; i++) {
        var s = tabSlots[i].getStack();
        setTabIcon(i, (s && !s.isEmpty()) ? s.getItemNbt().toJsonString() : null);
    }
}

// ========== interact ==========

function interact(event) {
    var player    = event.player;
    var api       = event.API;
    lastNpc       = event.npc;
    var worldData = lastNpc.getWorld().getStoreddata();

    var adminMode = player.getMainhandItem() && player.getMainhandItem().getName() === "minecraft:bedrock";
    if (!adminMode) { player.message("§cYou need bedrock in hand to edit the menu!"); return; }

    loadFromWorld(worldData);

    // Derive maxPages from data
    maxPages = deriveMaxPages(globalMenuData);
    if (maxPages < 1) maxPages = 1;

    if (currentPage >= maxPages) currentPage = 0;
    totalRows = Math.max(derivePageRows(globalMenuData, currentPage), viewportRows);

    highlightedSlot  = null;
    highlightLineIds = [];

    if (!guiRef) {
        guiRef = api.createCustomGui(176, 166, 0, true, player);

        var tw=25, th=28, ts=2, ty=-80;
        tabSlots = [];
        for (var i = 0; i < maxPages; i++) {
            tabSlots.push(guiRef.addItemSlot(i*(tw+ts)+4, ty+5));
            guiRef.addButton(ID_TAB_BASE+i, "", i*(tw+ts), ty, tw, th);
        }

        mySlots = slotPositions.map(function(pos){ return guiRef.addItemSlot(pos.x, pos.y); });

        var scrollX = startX + (numCols * colSpacing) + 2;
        guiRef.addButton(ID_SCROLL_UP,   "↑", scrollX, startY,    18, 18);
        guiRef.addButton(ID_SCROLL_DOWN, "↓", scrollX, startY+20, 18, 18);
        guiRef.addLabel(10, "", scrollX+1, startY+42, 0.7, 0.7);

        guiRef.addLabel(3, "§7Price:", 2, -100, 0.8, 0.8);
        guiRef.addTextField(ID_PRICE_FIELD, 60, -104, 60, 18).setText("");
        guiRef.addButton(ID_SET_PRICE_BUTTON, "Set", 125, -104, 35, 18);

        var tmx = (maxPages*27)+2;
        guiRef.addButton(ID_ADD_TAB,    "+", tmx,    -80, 16, 14);
        guiRef.addButton(ID_REMOVE_TAB, "-", tmx+18, -80, 16, 14);
        guiRef.addLabel(7, "§7Tabs", tmx-8, -92, 0.7, 0.7);

        guiRef.addLabel(1, "§6Menu Editor", 2, 63, 1.0, 1.0);
        guiRef.addLabel(6, "§7Total Rows:", -105, -29, 0.8, 0.8);
        guiRef.addTextField(ID_ROWS_FIELD, -105, -17, 40, 18).setText("" + totalRows);
        guiRef.addButton(ID_SET_ROWS_BUTTON, "Set", -60, -17, 30, 18);

        guiRef.showPlayerInventory(3, 91, false);
        player.showCustomGui(guiRef);
    }

    // Populate tab icons from GlobalMenuData
    for (var i = 0; i < tabSlots.length; i++) {
        tabSlots[i].setStack(null);
        var iconEntry = getTabIcon(i);
        if (iconEntry && iconEntry.tabIcon) {
            try { tabSlots[i].setStack(player.world.createItemFromNbt(api.stringToNbt(iconEntry.tabIcon))); } catch(e) {}
        }
    }

    highlightActiveTab();
    updateVisibleSlots(player, api);
    updateScrollIndicator();
    guiRef.update();
}

// ========== customGuiButton ==========

function customGuiButton(event) {
    var player    = event.player;
    var api       = event.API;
    var worldData = lastNpc.getWorld().getStoreddata();

    if (event.buttonId === ID_SCROLL_UP) {
        if (viewportRow > 0) {
            flushVisibleSlots();
            saveToWorld(worldData);
            viewportRow--;
            updateVisibleSlots(player, api);
            updateScrollIndicator();
            guiRef.update();
        }
        return;
    }

    if (event.buttonId === ID_SCROLL_DOWN) {
        if (viewportRow < Math.max(0, totalRows - viewportRows)) {
            flushVisibleSlots();
            saveToWorld(worldData);
            viewportRow++;
            updateVisibleSlots(player, api);
            updateScrollIndicator();
            guiRef.update();
        }
        return;
    }

    // Tab switch
    if (event.buttonId >= ID_TAB_BASE && event.buttonId < ID_TAB_BASE + maxPages) {
        var tabIndex = event.buttonId - ID_TAB_BASE;
        if (tabIndex !== currentPage) {
            flushVisibleSlots();
            flushTabIcons();
            saveToWorld(worldData);
            currentPage = tabIndex;
            viewportRow = 0;
            totalRows   = Math.max(derivePageRows(globalMenuData, currentPage), viewportRows);
            highlightActiveTab();
            updateVisibleSlots(player, api);
            updateScrollIndicator();
            guiRef.update();
        }
        return;
    }

    // Set Rows — just sets how many rows are visible, removes overflow slots
    if (event.buttonId === ID_SET_ROWS_BUTTON) {
        var rowsField = event.gui.getComponent(ID_ROWS_FIELD);
        if (!rowsField) return;
        var newRows = parseInt("" + rowsField.getText().trim());
        if (isNaN(newRows) || newRows < 1 || newRows > 100) {
            player.message("§cEnter a number between 1 and 100.");
            return;
        }
        flushVisibleSlots();
        // Delete any slots beyond the new row count
        var newMax = newRows * numCols;
        var oldMax = totalRows * numCols;
        for (var i = newMax; i < oldMax; i++) {
            setSlot(currentPage, i, null, null);
        }
        totalRows = newRows;
        var maxVR = Math.max(0, totalRows - viewportRows);
        if (viewportRow > maxVR) viewportRow = maxVR;
        saveToWorld(worldData);
        player.message("§aSet total rows to §e" + totalRows + " §afor this tab!");
        interact({ player: player, API: api, npc: lastNpc });
        return;
    }

    // Add Tab — just increment; new page has no data yet so deriveMaxPages will see it next open
    if (event.buttonId === ID_ADD_TAB) {
        if (maxPages >= 10) { player.message("§cMaximum 10 tabs allowed!"); return; }
        flushVisibleSlots();
        flushTabIcons();
        // Write a placeholder so the new page exists in the data
        globalMenuData["page" + maxPages + "_placeholder"] = { placeholder: true };
        saveToWorld(worldData);
        player.message("§aAdded tab! Total tabs: §e" + (maxPages + 1));
        guiRef = null; viewportRow = 0; currentPage = 0;
        skipSaveOnClose = true;
        event.gui.close();
        return;
    }

    // Remove Tab
    if (event.buttonId === ID_REMOVE_TAB) {
        if (maxPages <= 1) { player.message("§cMust have at least 1 tab!"); return; }
        flushVisibleSlots();
        flushTabIcons();

        var tabToDelete = currentPage;
        var newData = {};
        for (var key in globalMenuData) {
            if (!globalMenuData.hasOwnProperty(key)) continue;
            var m = key.match(/^page(\d+)_(.*)/);
            if (!m) continue;
            var pg     = parseInt(m[1]);
            var suffix = m[2];
            if (pg === tabToDelete) continue;
            var newPg = (pg > tabToDelete) ? pg - 1 : pg;
            newData["page" + newPg + "_" + suffix] = globalMenuData[key];
        }
        globalMenuData = newData;

        maxPages--;
        if (currentPage >= maxPages) currentPage = maxPages - 1;
        saveToWorld(worldData);
        player.message("§aDeleted tab §e" + (tabToDelete+1) + "§a! Total tabs: §e" + maxPages);
        guiRef = null; viewportRow = 0; currentPage = 0;
        skipSaveOnClose = true;
        event.gui.close();
        return;
    }

    // Set Price / Rename Tab
    if (event.buttonId === ID_SET_PRICE_BUTTON) {
        var priceField = event.gui.getComponent(ID_PRICE_FIELD);
        if (!priceField) return;
        var inputText = ("" + priceField.getText()).trim();
        if (!inputText) { player.message("§cPlease enter a value!"); return; }

        // Tab rename?
        for (var i = 0; i < tabSlots.length; i++) {
            if (tabSlots[i] === highlightedSlot) {
                var tabItem = highlightedSlot.getStack();
                if (!tabItem || tabItem.isEmpty()) { player.message("§cNo item in tab slot!"); return; }
                tabItem.setCustomName(inputText);
                highlightedSlot.setStack(tabItem);
                flushTabIcons();
                saveToWorld(worldData);
                player.message("§aRenamed tab to: " + inputText);
                return;
            }
        }

        if (!highlightedSlot) { player.message("§cSelect a slot first!"); return; }
        var item = highlightedSlot.getStack();
        if (!item || item.isEmpty()) { player.message("§cNo item in selected slot!"); return; }

        var price = Math.floor(parseFloat(inputText));
        if (isNaN(price) || price < 0) { player.message("§cInvalid price!"); return; }

        var lore = item.getLore();
        var newLore = [];
        for (var j = 0; j < lore.length; j++) {
            if (lore[j].indexOf("Price:") === -1) newLore.push(lore[j]);
        }
        while (newLore.length > 0 && newLore[newLore.length-1] === "") newLore.pop();
        newLore.push("");
        newLore.push("§aPrice: §e" + price + "¢");
        item.setLore(newLore);
        highlightedSlot.setStack(item);

        var si = mySlots.indexOf(highlightedSlot);
        if (si !== -1) {
            setSlot(currentPage, viewportToGlobal(si), item.getItemNbt().toJsonString(), price);
        }
        saveToWorld(worldData);
        player.message("§aSet price §e" + price + "¢ §afor item!");
    }
}

// ========== customGuiSlotClicked ==========

function customGuiSlotClicked(event) {
    var clickedSlot = event.slot;
    var stack       = event.stack;
    var player      = event.player;
    var worldData   = lastNpc.getWorld().getStoreddata();

    // Tab slot clicked — swap item directly
    for (var i = 0; i < tabSlots.length; i++) {
        if (tabSlots[i] === clickedSlot) {
            highlightedSlot = clickedSlot;
            var slotStack = clickedSlot.getStack();
            if (stack && !stack.isEmpty()) {
                var ic = player.world.createItemFromNbt(stack.getItemNbt());
                if (slotStack && !slotStack.isEmpty()) player.giveItem(slotStack);
                clickedSlot.setStack(ic);
                player.removeItem(stack, stack.getStackSize());
            } else if (slotStack && !slotStack.isEmpty()) {
                player.giveItem(slotStack);
                clickedSlot.setStack(player.world.createItem("minecraft:air", 1));
            }
            flushTabIcons();
            saveToWorld(worldData);
            guiRef.update();
            return;
        }
    }

    // Menu slot clicked — select + draw highlight
    var slotIndex = mySlots.indexOf(clickedSlot);
    if (slotIndex !== -1) {
        highlightedSlot = clickedSlot;
        for (var i = 0; i < highlightLineIds.length; i++) {
            try { guiRef.removeComponent(highlightLineIds[i]); } catch(e) {}
        }
        highlightLineIds = [];
        var pos = slotPositions[slotIndex];
        var x=pos.x, y=pos.y, w=18, h=18;
        highlightLineIds.push(guiRef.addColoredLine(1, x,   y,   x+w, y,   0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(2, x,   y+h, x+w, y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(3, x,   y,   x,   y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(4, x+w, y,   x+w, y+h, 0xADD8E6, 2));
        guiRef.update();
        return;
    }

    // Inventory click — transfer into highlighted slot
    if (!highlightedSlot) return;

    var isTabSlot = false;
    for (var i = 0; i < tabSlots.length; i++) {
        if (tabSlots[i] === highlightedSlot) { isTabSlot = true; break; }
    }

    try {
        var slotStack = highlightedSlot.getStack();
        var maxStack  = stack ? stack.getMaxStackSize() : 64;

        if (stack && !stack.isEmpty()) {
            if (slotStack && !slotStack.isEmpty() && slotStack.getDisplayName() === stack.getDisplayName()) {
                var total = slotStack.getStackSize() + stack.getStackSize();
                if (total <= maxStack) {
                    slotStack.setStackSize(total);
                    highlightedSlot.setStack(slotStack);
                    player.removeItem(stack, stack.getStackSize());
                } else {
                    var overflow = total - maxStack;
                    slotStack.setStackSize(maxStack);
                    highlightedSlot.setStack(slotStack);
                    var oc = player.world.createItemFromNbt(stack.getItemNbt());
                    oc.setStackSize(overflow);
                    player.removeItem(stack, stack.getStackSize());
                    player.giveItem(oc);
                }
            } else {
                var ic = player.world.createItemFromNbt(stack.getItemNbt());
                if (slotStack && !slotStack.isEmpty()) player.giveItem(slotStack);
                highlightedSlot.setStack(ic);
                player.removeItem(stack, stack.getStackSize());
            }
        } else if (slotStack && !slotStack.isEmpty()) {
            player.giveItem(slotStack);
            highlightedSlot.setStack(player.world.createItem("minecraft:air", 1));
        }

        if (isTabSlot) {
            flushTabIcons();
        } else {
            var si = mySlots.indexOf(highlightedSlot);
            if (si !== -1) {
                var gi = viewportToGlobal(si);
                var s  = highlightedSlot.getStack();
                if (s && !s.isEmpty()) {
                    var nbt = s.getItemNbt().toJsonString();
                    setSlot(currentPage, gi, nbt, extractPrice(nbt));
                } else {
                    setSlot(currentPage, gi, null, null);
                }
            }
        }
        saveToWorld(worldData);
        guiRef.update();
    } catch(e) {
        player.message("§cError: " + e);
    }
}

// ========== customGuiClosed ==========

function customGuiClosed(event) {
    if (!skipSaveOnClose && lastNpc) {
        flushVisibleSlots();
        flushTabIcons();
        saveToWorld(lastNpc.getWorld().getStoreddata());
    } else {
        skipSaveOnClose = false;
    }
    guiRef           = null;
    viewportRow      = 0;
    currentPage      = 0;
    highlightedSlot  = null;
    highlightLineIds = [];
}
