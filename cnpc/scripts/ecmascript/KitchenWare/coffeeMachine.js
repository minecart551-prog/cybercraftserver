// Coffee Machine Scripted Block
// Events: init, interact, timer, customGuiSlotClicked, customGuiClosed

var guiRef;
var ingredientSlots = [];
var outputSlot = null;
var lastBlock = null;
var highlightedSlot = null;
var highlightLineIds = [];

var BREW_TIME = 10; // 3 seconds
var INGREDIENT_COUNT = 3; // mug, cocoa beans, milk bottle

var brewingProgress = null; // In-memory only, not saved

// Slot position constants - change these to move slots
var INGREDIENT_START_X = 37;
var INGREDIENT_START_Y = -50;
var INGREDIENT_SPACING = 22;
var OUTPUT_X = 103;
var OUTPUT_Y = -30;

function init(event) {
    event.block.setModel("yuushya:lesser_fallen_leaves"); 
    event.block.setRotation(0,0,0);
}

function interact(event) {
    var player = event.player;
    var api = event.API;
    lastBlock = event.block;
    
    openCoffeeMachineGui(player, api);
}

function getBlockKey(block) {
    return "coffee_" + block.getX() + "_" + block.getY() + "_" + block.getZ();
}

function loadCoffeeData(block, apiOrWorld) {
    var world = block.getWorld();
    var worldData = world.getStoreddata();
    var blockKey = getBlockKey(block);
    
    if(worldData.has(blockKey)){
        try {
            return JSON.parse(worldData.get(blockKey));
        } catch(e) {
            return { ingredients: {}, output: null };
        }
    }
    return { ingredients: {}, output: null };
}

function saveCoffeeData(block, data) {
    var world = block.getWorld();
    var worldData = world.getStoreddata();
    var blockKey = getBlockKey(block);
    
    worldData.put(blockKey, JSON.stringify(data));
}

function reloadCoffeeItemsInGui(block, api) {
    // This function reloads items from storage into the GUI
    // Called by timer to show brewing progress
    if(!guiRef || !ingredientSlots || ingredientSlots.length === 0) return;
    if(!block) return;
    
    var world = block.getWorld();
    var data = loadCoffeeData(block, api);
    
    // Reload ingredient slots
    for(var i = 0; i < INGREDIENT_COUNT; i++){
        if(data.ingredients[i]){
            try {
                var item = world.createItemFromNbt(api.stringToNbt(data.ingredients[i]));
                if(ingredientSlots[i]) ingredientSlots[i].setStack(item);
            } catch(e) {}
        } else {
            if(ingredientSlots[i]) ingredientSlots[i].setStack(null);
        }
    }
    
    // Reload output slot
    if(data.output){
        try {
            var outputItem = world.createItemFromNbt(api.stringToNbt(data.output));
            if(outputSlot) outputSlot.setStack(outputItem);
        } catch(e) {}
    } else {
        if(outputSlot) outputSlot.setStack(null);
    }
}

function openCoffeeMachineGui(player, api) {
    if(!lastBlock) return;
    
    guiRef = api.createCustomGui(176, 166, 0, true, player);
    ingredientSlots = [];
    highlightedSlot = null;
    highlightLineIds = [];
    
    // Create 3 ingredient slots (vertical layout)
    for(var i = 0; i < INGREDIENT_COUNT; i++){
        var y = INGREDIENT_START_Y + i * INGREDIENT_SPACING;
        var slot = guiRef.addItemSlot(INGREDIENT_START_X, y);
        ingredientSlots.push(slot);
    }
    
    // Create output slot on the right
    outputSlot = guiRef.addItemSlot(OUTPUT_X, OUTPUT_Y);
    
    // Labels
    guiRef.addLabel(1, "§6Coffee Machine", 43, -75, 1.0, 1.0);
    guiRef.addLabel(5, "§eCoffee", 94, -48, 0.7, 0.7);
    
    // Show player inventory
    guiRef.showPlayerInventory(0, 43, false);
    
    // Load items from storage
    loadCoffeeItems(player, api);
    
    player.showCustomGui(guiRef);
}

function loadCoffeeItems(player, api) {
    if(!lastBlock) return;
    
    var data = loadCoffeeData(lastBlock, api);
    
    // Load ingredient slots
    for(var i = 0; i < INGREDIENT_COUNT; i++){
        if(data.ingredients[i]){
            try {
                var item = player.world.createItemFromNbt(api.stringToNbt(data.ingredients[i]));
                ingredientSlots[i].setStack(item);
            } catch(e) {}
        }
    }
    
    // Load output slot
    if(data.output){
        try {
            var outputItem = player.world.createItemFromNbt(api.stringToNbt(data.output));
            outputSlot.setStack(outputItem);
        } catch(e) {}
    }
}

function customGuiClosed(event) {
    if(!lastBlock) return;
    saveCoffeeItems();
    guiRef = null;
}

function drawSlotHighlight(x, y) {
    // Offset highlight by 1 pixel left and 1 pixel up
    x = x - 1;
    y = y - 1;
    
    var w = 18, h = 18;
    
    // Clear old highlights
    for(var i = 0; i < highlightLineIds.length; i++){
        try { guiRef.removeComponent(highlightLineIds[i]); } catch(e) {}
    }
    highlightLineIds = [];
    
    // Draw new highlight with unique IDs that won't conflict with labels
    highlightLineIds.push(guiRef.addColoredLine(101, x, y, x+w, y, 0xADD8E6, 2));
    highlightLineIds.push(guiRef.addColoredLine(102, x, y+h, x+w, y+h, 0xADD8E6, 2));
    highlightLineIds.push(guiRef.addColoredLine(103, x, y, x, y+h, 0xADD8E6, 2));
    highlightLineIds.push(guiRef.addColoredLine(104, x+w, y, x+w, y+h, 0xADD8E6, 2));
    
    guiRef.update();
}

function customGuiSlotClicked(event) {
    var clickedSlot = event.slot;
    var stack = event.stack;
    var player = event.player;
    var api = event.API;
    
    // Check if clicked slot is an ingredient slot
    var slotIndex = ingredientSlots.indexOf(clickedSlot);
    var isOutputSlot = (clickedSlot === outputSlot);
    
    if(slotIndex !== -1) {
        // Clicked an ingredient slot
        highlightedSlot = clickedSlot;
        
        // Calculate position based on slot index
        var x = INGREDIENT_START_X;
        var y = INGREDIENT_START_Y + slotIndex * INGREDIENT_SPACING;
        
        drawSlotHighlight(x, y);
        return;
    }
    
    if(isOutputSlot) {
        // Clicked output slot
        highlightedSlot = clickedSlot;
        
        drawSlotHighlight(OUTPUT_X, OUTPUT_Y);
        return;
    }
    
    // If no slot is highlighted, return
    if(!highlightedSlot) return;
    
    // Check if highlighted slot is the output slot
    if(highlightedSlot === outputSlot){
        var outputStack = outputSlot.getStack();
        
        if(outputStack && !outputStack.isEmpty()) {
            if(!stack || stack.isEmpty()) {
                // Empty hand, take item
                player.giveItem(outputStack);
                outputSlot.setStack(player.world.createItem("minecraft:air", 1));
            } else if(stack.getDisplayName() === outputStack.getDisplayName()){
                // Same item, try to stack
                var total = outputStack.getStackSize() + stack.getStackSize();
                var maxStack = stack.getMaxStackSize();
                
                if(total <= maxStack){
                    // Can fit in hand
                    player.removeItem(stack, stack.getStackSize());
                    outputStack.setStackSize(total);
                    player.giveItem(outputStack);
                    outputSlot.setStack(player.world.createItem("minecraft:air", 1));
                }
            }
        }
        
        guiRef.update();
        saveCoffeeItems();
        return;
    }
    
    var slotStack = highlightedSlot.getStack();
    var maxStack = stack ? stack.getMaxStackSize() : 64;
    
    if(stack && !stack.isEmpty()) {
        // Player clicked with item in hand
        if(slotStack && !slotStack.isEmpty() && slotStack.getDisplayName() === stack.getDisplayName()) {
            // Same item, stack
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
            // Different item, swap
            var itemCopy = player.world.createItemFromNbt(stack.getItemNbt());
            itemCopy.setStackSize(stack.getStackSize());
            if(slotStack && !slotStack.isEmpty()) player.giveItem(slotStack);
            highlightedSlot.setStack(itemCopy);
            player.removeItem(stack, stack.getStackSize());
        }
    } else if(slotStack && !slotStack.isEmpty()) {
        // Empty hand, take item
        player.giveItem(slotStack);
        highlightedSlot.setStack(player.world.createItem("minecraft:air", 1));
    }
    
    guiRef.update();
    saveCoffeeItems();
}

function saveCoffeeItems() {
    if(!lastBlock) return;
    
    var data = { ingredients: {}, output: null };
    
    // Save ingredient slots
    for(var i = 0; i < ingredientSlots.length; i++){
        var stack = ingredientSlots[i].getStack();
        
        if(stack && !stack.isEmpty()){
            data.ingredients[i] = stack.getItemNbt().toJsonString();
        }
    }
    
    // Save output slot
    var outputStack = outputSlot.getStack();
    if(outputStack && !outputStack.isEmpty()){
        data.output = outputStack.getItemNbt().toJsonString();
    }
    
    saveCoffeeData(lastBlock, data);
    
    // Check if we should start or stop the timer
    checkAndUpdateTimer(lastBlock);
}

function checkAndUpdateTimer(block) {
    if(!block) return;
    
    var world = block.getWorld();
    var data = loadCoffeeData(block, world);
    var API = Java.type("noppes.npcs.api.NpcAPI").Instance();
    
    // Check if output slot has coffee
    var hasOutputCoffee = false;
    if(data.output){
        try {
            var outputItem = world.createItemFromNbt(API.stringToNbt(data.output));
            if(outputItem && !outputItem.isEmpty()){
                hasOutputCoffee = true;
            }
        } catch(e) {}
    }
    
    // Check if all ingredients are present
    var hasMug = false;
    var hasCocoaBeans = false;
    var hasMilk = false;
    
    for(var i = 0; i < INGREDIENT_COUNT; i++){
        if(data.ingredients[i]){
            try {
                var item = world.createItemFromNbt(API.stringToNbt(data.ingredients[i]));
                if(item && !item.isEmpty()){
                    if(item.getName() === "yuushya:mug"){
                        hasMug = true;
                    } else if(item.getName() === "minecraft:cocoa_beans"){
                        hasCocoaBeans = true;
                    } else if(item.getName() === "farmersdelight:milk_bottle"){
                        hasMilk = true;
                    }
                }
            } catch(e) {}
        }
    }
    
    var hasAllIngredients = hasMug && hasCocoaBeans && hasMilk;
    var shouldRun = hasAllIngredients && !hasOutputCoffee;
    
    if(shouldRun){
        // Start timer if not already running
        block.timers.forceStart(1, 20, true); // Every 1 second, repeating
    } else {
        // Stop timer
        block.timers.stop(1);
        brewingProgress = null;
    }
}

function timer(event) {
    // Only process timer ID 1 (our brewing timer)
    if(event.id !== 1) return;
    
    var block = event.block;
    var api = event.API;
    var world = block.getWorld();
    var data = loadCoffeeData(block, api);
    
    // Check if output slot already has coffee
    var hasOutputCoffee = false;
    if(data.output){
        try {
            var outputItem = world.createItemFromNbt(api.stringToNbt(data.output));
            if(outputItem && !outputItem.isEmpty()){
                hasOutputCoffee = true;
            }
        } catch(e) {}
    }
    
    if(hasOutputCoffee){
        // Can't brew while output has coffee - stop timer
        block.timers.stop(1);
        brewingProgress = null;
        return;
    }
    
    // Check if all ingredients are present (in any order)
    var hasMug = false;
    var hasCocoaBeans = false;
    var hasMilk = false;
    
    var ingredientItems = [];
    
    // Scan all ingredient slots
    for(var i = 0; i < INGREDIENT_COUNT; i++){
        if(data.ingredients[i]){
            try {
                var item = world.createItemFromNbt(api.stringToNbt(data.ingredients[i]));
                if(item && !item.isEmpty()){
                    ingredientItems.push({index: i, item: item});
                    
                    if(item.getName() === "yuushya:mug"){
                        hasMug = true;
                    } else if(item.getName() === "minecraft:cocoa_beans"){
                        hasCocoaBeans = true;
                    } else if(item.getName() === "farmersdelight:milk_bottle"){
                        hasMilk = true;
                    }
                }
            } catch(e) {}
        }
    }
    
    var hasAllIngredients = hasMug && hasCocoaBeans && hasMilk;
    
    if(!hasAllIngredients){
        // Missing ingredients - stop timer
        block.timers.stop(1);
        brewingProgress = null;
        return;
    }
    
    // Start or continue brewing
    if(!brewingProgress){
        brewingProgress = {
            secondsElapsed: 0
        };
    }
    
    brewingProgress.secondsElapsed++;
    var secondsRemaining = BREW_TIME - brewingProgress.secondsElapsed;
    
    if(brewingProgress.secondsElapsed >= BREW_TIME){
        // Coffee is ready!
        
        // Consume ingredients (find and consume each type)
        for(var i = 0; i < ingredientItems.length; i++){
            var itemData = ingredientItems[i];
            var itemName = itemData.item.getName();
            
            if(itemName === "yuushya:mug" || 
               itemName === "minecraft:cocoa_beans" || 
               itemName === "farmersdelight:milk_bottle"){
                
                if(itemData.item.getStackSize() > 1){
                    itemData.item.setStackSize(itemData.item.getStackSize() - 1);
                    data.ingredients[itemData.index] = itemData.item.getItemNbt().toJsonString();
                } else {
                    data.ingredients[itemData.index] = null;
                }
            }
        }
        
        // Add coffee to output slot (stack if possible)
        if(data.output){
            try {
                var existingCoffee = world.createItemFromNbt(api.stringToNbt(data.output));
                if(existingCoffee && !existingCoffee.isEmpty() && 
                   existingCoffee.getName() === "yuushya:small_coffee"){
                    // Stack coffee
                    var newAmount = existingCoffee.getStackSize() + 1;
                    var maxStack = existingCoffee.getMaxStackSize();
                    
                    if(newAmount <= maxStack){
                        existingCoffee.setStackSize(newAmount);
                        data.output = existingCoffee.getItemNbt().toJsonString();
                    } else {
                        // Output is full, can't add more
                        // Don't consume ingredients, stop timer
                        brewingProgress = null;
                        saveCoffeeData(block, data);
                        reloadCoffeeItemsInGui(block, api);
                        block.timers.stop(1);
                        return;
                    }
                } else {
                    // Different item in output, replace with coffee
                    var coffee = world.createItem("yuushya:small_coffee", 1);
                    data.output = coffee.getItemNbt().toJsonString();
                }
            } catch(e) {
                var coffee = world.createItem("yuushya:small_coffee", 1);
                data.output = coffee.getItemNbt().toJsonString();
            }
        } else {
            // No item in output, create coffee
            var coffee = world.createItem("yuushya:small_coffee", 1);
            data.output = coffee.getItemNbt().toJsonString();
        }
        
        // Save data first
        saveCoffeeData(block, data);
        
        // Reset brewing progress to start next batch
        brewingProgress = null;
        
        // Update GUI
        reloadCoffeeItemsInGui(block, api);
        
        // Timer will continue on next tick if ingredients still available
    }
}