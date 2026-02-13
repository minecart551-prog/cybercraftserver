var guiRef;
var mySlots = [];
var highlightLineIds = [];

// === CONFIG ===
var GRID_ROWS = 6;
var GRID_COLS = 6;
var START_X   = 60;
var START_Y   = -50;
var COL_SPACING = 20;
var ROW_SPACING = 20;

var slotPositions = [];
for (var row = 0; row < GRID_ROWS; row++) {
    for (var col = 0; col < GRID_COLS; col++) {
        slotPositions.push({x: START_X + col * COL_SPACING, y: START_Y + row * ROW_SPACING});
    }
}
var GRID_SIZE = slotPositions.length;

var highlightedSlot = null;
var lastNpc = null;
var storedSlotItems = []; // array of nbt-strings or null

// Helper: create array filled with null
function makeNullArray(n){
    var a = new Array(n);
    for (var i=0;i<n;i++) a[i] = null;
    return a;
}

// ---------- INTERACT ----------
function interact(event) {
    var player = event.player;
    var api = event.API;
    lastNpc = event.npc;
    var npcData = lastNpc.getStoreddata();

    // Load stored items
    if (npcData.has("SlotItems")) {
        try {
            storedSlotItems = JSON.parse(npcData.get("SlotItems"));
            if (!storedSlotItems || storedSlotItems.length < GRID_SIZE) {
                var tmp = makeNullArray(GRID_SIZE);
                if (storedSlotItems && storedSlotItems.length > 0) {
                    for (var t = 0; t < storedSlotItems.length && t < GRID_SIZE; t++) tmp[t] = storedSlotItems[t];
                }
                storedSlotItems = tmp;
            }
        } catch(e){
            storedSlotItems = makeNullArray(GRID_SIZE);
        }
    } else {
        storedSlotItems = makeNullArray(GRID_SIZE);
    }

    var handItem = player.getMainhandItem();

    // --- ADMIN MODE: If holding bedrock -> open GUI editor ---
    if (handItem && !handItem.isEmpty() && handItem.getName() === "minecraft:bedrock") {
        highlightedSlot = null;
        highlightLineIds = [];

        guiRef = api.createCustomGui(176, 166, 0, true, player);

        // Create reward grid slots
        mySlots = slotPositions.map(function(pos, i) {
            var slot = guiRef.addItemSlot(pos.x, pos.y);
            if (storedSlotItems[i]) {
                try {
                    slot.setStack(player.world.createItemFromNbt(api.stringToNbt(storedSlotItems[i])));
                } catch(e) {}
            }
            return slot;
        });

        guiRef.showPlayerInventory(10, 110, false);
        player.showCustomGui(guiRef);
        return;
    }

    // --- NORMAL PLAYER MODE: Check package claim ---
    var pdata = player.getStoreddata();

    // Initialize flag if first interaction
    if (!pdata.has("canGetPackage")) {
        pdata.put("canGetPackage", 1);
    }

    if (pdata.get("canGetPackage")) {
        // collect available rewards
        var rewardChoices = [];
        for (var i = 0; i < GRID_SIZE; i++) {
            if (storedSlotItems[i]) {
                rewardChoices.push(storedSlotItems[i]);
            }
        }

        if (rewardChoices.length > 0) {
            var choice = rewardChoices[Math.floor(Math.random() * rewardChoices.length)];
            try {
                var reward = player.world.createItemFromNbt(api.stringToNbt(choice));
                player.giveItem(reward);
                player.message("§aYou received: §f" + reward.getDisplayName());
            } catch(e) {}
        }

        // switch to false after giving package
        pdata.put("canGetPackage", 0);

    } else {
        player.message("§cYou can't get another package right now.");
    }
    
}

// ---------- SLOT CLICK ----------
function customGuiSlotClicked(event) {
    var clickedSlot = event.slot;
    var stack = event.stack;
    var player = event.player;

    var slotIndex = mySlots.indexOf(clickedSlot);
    if (slotIndex !== -1) {
        highlightedSlot = clickedSlot;
        for (var h = 0; h < highlightLineIds.length; h++){
            try { guiRef.removeComponent(highlightLineIds[h]); } catch(e){}
        }
        highlightLineIds = [];

        var pos = slotPositions[slotIndex];
        var x = pos.x, y = pos.y, w = 18, h = 18;
        highlightLineIds.push(guiRef.addColoredLine(1, x, y, x+w, y, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(2, x, y+h, x+w, y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(3, x, y, x, y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(4, x+w, y, x+w, y+h, 0xADD8E6, 2));
        guiRef.update();
        return;
    }

    if (!highlightedSlot) return;

    try {
        var slotStack = highlightedSlot.getStack();
        var maxStack = stack ? stack.getMaxStackSize() : 64;

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
                    var overflowCopy = player.world.createItemFromNbt(stack.getItemNbt());
                    overflowCopy.setStackSize(overflow);
                    player.removeItem(stack, stack.getStackSize());
                    player.giveItem(overflowCopy);
                }
            } else {
                var itemCopy = player.world.createItemFromNbt(stack.getItemNbt());
                if (slotStack && !slotStack.isEmpty()) player.giveItem(slotStack);
                highlightedSlot.setStack(itemCopy);
                player.removeItem(stack, stack.getStackSize());
            }
        } else if (slotStack && !slotStack.isEmpty()) {
            player.giveItem(slotStack);
            highlightedSlot.setStack(player.world.createItem("minecraft:air", 1));
            guiRef.update();
        }

        guiRef.update();
    } catch(e) {}
}

// ---------- GUI CLOSED: persist ----------
function customGuiClosed(event) {
    if (!lastNpc) return;

    var toSave = makeNullArray(GRID_SIZE);
    for (var i = 0; i < mySlots.length && i < GRID_SIZE; i++) {
        try {
            var st = mySlots[i].getStack();
            toSave[i] = (st && !st.isEmpty()) ? st.getItemNbt().toJsonString() : null;
        } catch(e) {
            toSave[i] = null;
        }
    }
    lastNpc.getStoreddata().put("SlotItems", JSON.stringify(toSave));
}