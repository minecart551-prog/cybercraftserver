// Cold Drink Machine Scripted Block
// Events: init, interact, timer, customGuiSlotClicked, customGuiClosed

var guiRef;
var ingredientSlots = [];
var outputSlot = null;
var lastBlock = null;
var highlightedSlot = null;
var highlightLineIds = [];

var BREW_TIME = 10; // 10 seconds
var INGREDIENT_COUNT = 3; // 3 ingredient slots

var brewingProgress = null; // In-memory only, not saved

// Slot position constants - change these to move slots
var INGREDIENT_START_X = 37;
var INGREDIENT_START_Y = -50;
var INGREDIENT_SPACING = 22;
var OUTPUT_X = 103;
var OUTPUT_Y = -30;

// ============================================================

var RECIPES = [
    // Recipe 1: Iced Coffee
    {
        output: "yuushya:sea_salt_tea", 
        ingredients: [
            "farmersdelight:milk_bottle",
            "kubejs:tea_leaf",
            "kubejs:salt"
        ]
    },

];

// ============================================================

function init(event) {
    event.block.setModel("yuushya:lesser_fallen_leaves"); 
    event.block.setRotation(0,0,0);
}

function interact(event) {
    var player = event.player;
    var api = event.API;
    lastBlock = event.block;
    
    openDrinkMachineGui(player, api);
}

function getBlockKey(block) {
    return "drink_" + block.getX() + "_" + block.getY() + "_" + block.getZ();
}

function loadDrinkData(block) {
    var world = block.getWorld();
    var tempData = world.getTempdata();
    var blockKey = getBlockKey(block);
    
    if(tempData.has(blockKey)){
        try {
            return JSON.parse(tempData.get(blockKey));
        } catch(e) {
            return { ingredients: {}, output: null };
        }
    }
    return { ingredients: {}, output: null };
}

function saveDrinkData(block, data) {
    var world = block.getWorld();
    var tempData = world.getTempdata();
    var blockKey = getBlockKey(block);
    
    tempData.put(blockKey, JSON.stringify(data));
}

function reloadDrinkItemsInGui(block, api) {
    if(!guiRef || !ingredientSlots || ingredientSlots.length === 0) return;
    if(!block) return;
    
    var world = block.getWorld();
    var data = loadDrinkData(block);
    
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
    
    if(data.output){
        try {
            var outputItem = world.createItemFromNbt(api.stringToNbt(data.output));
            if(outputSlot) outputSlot.setStack(outputItem);
        } catch(e) {}
    } else {
        if(outputSlot) outputSlot.setStack(null);
    }
}

function openDrinkMachineGui(player, api) {
    if(!lastBlock) return;
    
    guiRef = api.createCustomGui(176, 166, 0, true, player);
    ingredientSlots = [];
    highlightedSlot = null;
    highlightLineIds = [];
    
    for(var i = 0; i < INGREDIENT_COUNT; i++){
        var y = INGREDIENT_START_Y + i * INGREDIENT_SPACING;
        var slot = guiRef.addItemSlot(INGREDIENT_START_X, y);
        ingredientSlots.push(slot);
    }
    
    outputSlot = guiRef.addItemSlot(OUTPUT_X, OUTPUT_Y);
    
    guiRef.addLabel(1, "§bCold Drink Machine", 33, -75, 1.0, 1.0);
    guiRef.addLabel(5, "§aDrink", 100, -48, 0.7, 0.7);
    
    guiRef.showPlayerInventory(0, 43, false);
    
    loadDrinkItems(player, api);
    
    player.showCustomGui(guiRef);
}

function loadDrinkItems(player, api) {
    if(!lastBlock) return;
    
    var data = loadDrinkData(lastBlock);
    
    for(var i = 0; i < INGREDIENT_COUNT; i++){
        if(data.ingredients[i]){
            try {
                var item = player.world.createItemFromNbt(api.stringToNbt(data.ingredients[i]));
                ingredientSlots[i].setStack(item);
            } catch(e) {}
        }
    }
    
    if(data.output){
        try {
            var outputItem = player.world.createItemFromNbt(api.stringToNbt(data.output));
            outputSlot.setStack(outputItem);
        } catch(e) {}
    }
}

function customGuiClosed(event) {
    if(!lastBlock) return;
    saveDrinkItems();
    guiRef = null;
}

function drawSlotHighlight(x, y) {
    x = x - 1;
    y = y - 1;
    
    var w = 18, h = 18;
    
    for(var i = 0; i < highlightLineIds.length; i++){
        try { guiRef.removeComponent(highlightLineIds[i]); } catch(e) {}
    }
    highlightLineIds = [];
    
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
    
    var slotIndex = ingredientSlots.indexOf(clickedSlot);
    var isOutputSlot = (clickedSlot === outputSlot);
    
    if(slotIndex !== -1) {
        highlightedSlot = clickedSlot;
        
        var x = INGREDIENT_START_X;
        var y = INGREDIENT_START_Y + slotIndex * INGREDIENT_SPACING;
        
        drawSlotHighlight(x, y);
        return;
    }
    
    if(isOutputSlot) {
        highlightedSlot = clickedSlot;
        
        drawSlotHighlight(OUTPUT_X, OUTPUT_Y);
        return;
    }
    
    if(!highlightedSlot) return;
    
    if(highlightedSlot === outputSlot){
        var outputStack = outputSlot.getStack();
        
        if(outputStack && !outputStack.isEmpty()) {
            if(!stack || stack.isEmpty()) {
                player.giveItem(outputStack);
                outputSlot.setStack(player.world.createItem("minecraft:air", 1));
            } else if(stack.getDisplayName() === outputStack.getDisplayName()){
                var total = outputStack.getStackSize() + stack.getStackSize();
                var maxStack = stack.getMaxStackSize();
                
                if(total <= maxStack){
                    player.removeItem(stack, stack.getStackSize());
                    outputStack.setStackSize(total);
                    player.giveItem(outputStack);
                    outputSlot.setStack(player.world.createItem("minecraft:air", 1));
                }
            }
        }
        
        guiRef.update();
        saveDrinkItems();
        return;
    }
    
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
                if(overflow > 0){
                    var overflowItem = player.world.createItemFromNbt(stack.getItemNbt());
                    overflowItem.setStackSize(overflow);
                    player.removeItem(stack, stack.getStackSize());
                    player.giveItem(overflowItem);
                }
            }
        } else {
            var itemCopy = player.world.createItemFromNbt(stack.getItemNbt());
            itemCopy.setStackSize(stack.getStackSize());
            if(slotStack && !slotStack.isEmpty()) player.giveItem(slotStack);
            highlightedSlot.setStack(itemCopy);
            player.removeItem(stack, stack.getStackSize());
        }
    } else if(slotStack && !slotStack.isEmpty()) {
        player.giveItem(slotStack);
        highlightedSlot.setStack(player.world.createItem("minecraft:air", 1));
    }
    
    guiRef.update();
    saveDrinkItems();
}

function saveDrinkItems() {
    if(!lastBlock) return;
    
    var data = { ingredients: {}, output: null };
    
    for(var i = 0; i < ingredientSlots.length; i++){
        var stack = ingredientSlots[i].getStack();
        
        if(stack && !stack.isEmpty()){
            data.ingredients[i] = stack.getItemNbt().toJsonString();
        }
    }
    
    var outputStack = outputSlot.getStack();
    if(outputStack && !outputStack.isEmpty()){
        data.output = outputStack.getItemNbt().toJsonString();
    }
    
    saveDrinkData(lastBlock, data);
    
    checkAndUpdateTimer(lastBlock);
}

function itemMatchesIngredient(item, requiredType) {
    if(!item || !requiredType) return false;
    if(item.getName() !== requiredType) return false;
    return true;
}

function findMatchingRecipe(ingredientItems) {
    for(var r = 0; r < RECIPES.length; r++){
        var recipe = RECIPES[r];
        var matched = 0;
        var usedItems = [];
        
        for(var i = 0; i < recipe.ingredients.length; i++){
            var requiredType = recipe.ingredients[i];
            
            for(var j = 0; j < ingredientItems.length; j++){
                if(usedItems.indexOf(j) !== -1) continue;
                
                if(itemMatchesIngredient(ingredientItems[j].item, requiredType)){
                    matched++;
                    usedItems.push(j);
                    break;
                }
            }
        }
        
        if(matched === recipe.ingredients.length){
            return recipe;
        }
    }
    
    return null;
}

function checkAndUpdateTimer(block) {
    if(!block) return;
    
    var world = block.getWorld();
    var data = loadDrinkData(block);
    var API = Java.type("noppes.npcs.api.NpcAPI").Instance();
    
    var hasOutputDrink = false;
    if(data.output){
        try {
            var outputItem = world.createItemFromNbt(API.stringToNbt(data.output));
            if(outputItem && !outputItem.isEmpty()){
                hasOutputDrink = true;
            }
        } catch(e) {}
    }
    
    var ingredientItems = [];
    for(var i = 0; i < INGREDIENT_COUNT; i++){
        if(data.ingredients[i]){
            try {
                var item = world.createItemFromNbt(API.stringToNbt(data.ingredients[i]));
                if(item && !item.isEmpty()){
                    ingredientItems.push({index: i, item: item});
                }
            } catch(e) {}
        }
    }
    
    var matchingRecipe = findMatchingRecipe(ingredientItems);
    var hasValidRecipe = (matchingRecipe !== null);
    
    var shouldRun = hasValidRecipe && !hasOutputDrink;
    
    if(shouldRun){
        block.timers.forceStart(1, 20, true);
    } else {
        block.timers.stop(1);
        brewingProgress = null;
    }
}

function timer(event) {
    if(event.id !== 1) return;
    
    var block = event.block;
    var api = event.API;
    var world = block.getWorld();
    var data = loadDrinkData(block);
    
    var hasOutputDrink = false;
    if(data.output){
        try {
            var outputItem = world.createItemFromNbt(api.stringToNbt(data.output));
            if(outputItem && !outputItem.isEmpty()){
                hasOutputDrink = true;
            }
        } catch(e) {}
    }
    
    if(hasOutputDrink){
        block.timers.stop(1);
        brewingProgress = null;
        return;
    }
    
    var ingredientItems = [];
    for(var i = 0; i < INGREDIENT_COUNT; i++){
        if(data.ingredients[i]){
            try {
                var item = world.createItemFromNbt(api.stringToNbt(data.ingredients[i]));
                if(item && !item.isEmpty()){
                    ingredientItems.push({index: i, item: item});
                }
            } catch(e) {}
        }
    }
    
    var matchingRecipe = findMatchingRecipe(ingredientItems);
    
    if(!matchingRecipe){
        block.timers.stop(1);
        brewingProgress = null;
        return;
    }
    
    if(!brewingProgress){
        brewingProgress = {
            secondsElapsed: 0
        };
    }
    
    brewingProgress.secondsElapsed++;
    var secondsRemaining = BREW_TIME - brewingProgress.secondsElapsed;
    
    if(brewingProgress.secondsElapsed >= BREW_TIME){
        var usedItems = [];
        for(var i = 0; i < matchingRecipe.ingredients.length; i++){
            var requiredType = matchingRecipe.ingredients[i];
            
            for(var j = 0; j < ingredientItems.length; j++){
                if(usedItems.indexOf(j) !== -1) continue;
                
                var itemData = ingredientItems[j];
                if(itemMatchesIngredient(itemData.item, requiredType)){
                    if(itemData.item.getStackSize() > 1){
                        itemData.item.setStackSize(itemData.item.getStackSize() - 1);
                        data.ingredients[itemData.index] = itemData.item.getItemNbt().toJsonString();
                    } else {
                        data.ingredients[itemData.index] = null;
                    }
                    usedItems.push(j);
                    break;
                }
            }
        }
        
        var outputDrink = world.createItem(matchingRecipe.output, 1);
        
        if(data.output){
            try {
                var existingDrink = world.createItemFromNbt(api.stringToNbt(data.output));
                if(existingDrink && !existingDrink.isEmpty() && 
                   existingDrink.getName() === outputDrink.getName()){
                    var newAmount = existingDrink.getStackSize() + 1;
                    var maxStack = existingDrink.getMaxStackSize();
                    
                    if(newAmount <= maxStack){
                        existingDrink.setStackSize(newAmount);
                        data.output = existingDrink.getItemNbt().toJsonString();
                    } else {
                        brewingProgress = null;
                        saveDrinkData(block, data);
                        reloadDrinkItemsInGui(block, api);
                        block.timers.stop(1);
                        return;
                    }
                } else {
                    data.output = outputDrink.getItemNbt().toJsonString();
                }
            } catch(e) {
                data.output = outputDrink.getItemNbt().toJsonString();
            }
        } else {
            data.output = outputDrink.getItemNbt().toJsonString();
        }
        
        saveDrinkData(block, data);
        
        brewingProgress = null;
        
        reloadDrinkItemsInGui(block, api);
    }
}
