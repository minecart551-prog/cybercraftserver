// ========== FISH SELLING NPC SCRIPT ==========
// Player right-clicks NPC while holding a fish to sell it
// Payment based on: Fish type (value multiplier) + Fish size + Category bonus

// ========== PRICING CONFIGURATION ==========
var BASE_COIN_VALUE = 3;    // Base price for 1.5x multiplier fish at typical low size
var BASE_MULTIPLIER = 1.5;  // Base multiplier (Cave Crawler)
var CURRENCY_ITEM = "coins:stone_coin"; // Stone coin currency
var CURRENCY_FALLBACK = "minecraft:gold_nugget";    // Fallback if currency doesn't exist

// ========== CATEGORY VALUE MULTIPLIERS ==========
// Adjust these to make certain categories more/less valuable
var CATEGORY_MULTIPLIERS = {
    "underground": 1.0,     // Base category (no bonus)
    "cold_ocean": 1.2,       // 30% more valuable than underground
    "cold_ocean_rare": 1.3,      // 10% more valuable (for future use)

};

// ========== UNDERGROUND FISH DATABASE ========== BIOME:FOREST
var UNDERGROUND_FISH = {
    // Common tier
    "tide:cave_crawler": [1.5, 45, 60, 100, "Cave Crawler"],
    "tide:deep_grouper": [1.8, 55, 75, 115, "Deep Grouper"],
    "tide:shadow_snapper": [1.8, 35, 65, 120, "Shadow Snapper"],
    "tide:cave_eel": [2.0, 90, 115, 150, "Cave Eel"],
    
    // Uncommon tier
    "tide:iron_tetra": [2.5, 2.8, 4.5, 8, "Iron Tetra"],
    "tide:lapis_lanternfish": [2.5, 5, 15, 40, "Lapis Lanternfish"],
    "tide:glowfish": [2.5, 55, 75, 110, "Glowfish"],
    "tide:anglerfish": [3.0, 20, 35, 75, "Anglerfish"],
    "tide:crystal_shrimp": [3.0, 4, 8, 15, "Crystal Shrimp"],
    "tide:abyss_angler": [3.5, 20, 35, 75, "Abyss Angler"],
    "tide:dripstone_darter": [3.5, 35, 55, 95, "Dripstone Darter"],
    
    // Rare tier
    "tide:luminescent_jellyfish": [4.5, 40, 50, 80, "Luminescent Jellyfish"],
    "tide:gilded_minnow": [5.0, 8, 15, 28, "Gilded Minnow"],
    "tide:bedrock_tetra": [5.0, 2.8, 4.5, 8, "Bedrock Tetra"],
    "tide:crystalline_carp": [5.5, 40, 80, 120, "Crystalline Carp"],
    
    // Very Rare tier
    "tide:echo_snapper": [6.5, 65, 85, 140, "Echo Snapper"],
    "tide:chasm_eel": [7.5, 120, 180, 300, "Chasm Eel"],
    
    // Legendary tier
    "tide:midas_fish": [9.0, 50, 80, 130, "Midas Fish"],
    "tide:devils_hole_pupfish": [10.0, 1.4, 2.6, 4.3, "Devil's Hole Pupfish"]
};

// ========== COLD OCEAN FISH DATABASE ========== BIOME: COLD OCEAN
var COLD_OCEAN_FISH = {
    // Common tier
    "tide:anchovy": [1.5, 6, 12, 20, "Anchovy"],
    "tide:flounder": [1.8, 40, 55, 75, "Flounder"],
    "tide:mackerel": [1.5, 30, 45, 65, "Mackerel"],
    "tide:snook": [2.0, 38, 68, 125, "Snook"],
    "tide:tuna": [2.5, 90, 150, 300, "Tuna"],
    "tide:mahi_mahi": [2.0, 60, 100, 210, "Mahi Mahi"],
    "tide:red_snapper": [1.8, 35, 60, 100, "Red Snapper"],
    
    // Uncommon tier
    "tide:angelfish": [3.0, 10, 13, 20, "Angelfish"],
    
    // Rare tier
    "tide:spore_stalker": [5.0, 35, 55, 90, "Spore Stalker"],
    "tide:swordfish": [5.5, 180, 290, 455, "Swordfish"],
    "tide:opah": [4.5, 80, 130, 270, "Opah"],
    "tide:oarfish": [5.0, 300, 600, 1100, "Oarfish"],
    "tide:moonfish": [4.5, 25, 45, 100, "Moonfish"],
    
};


// ========== COLD OCEAN RARE FISH DATABASE ========== BIOME: 
var COLD_OCEAN_RARE_FISH = {
    
    // Very Rare tier
    "tide:aquathorn": [7.0, 32, 45, 70, "Aquathorn"],
    "tide:great_white_shark": [7.5, 370, 490, 610, "Great White Shark"],
    "tide:saturn_cuttlefish": [6.5, 90, 120, 180, "Saturn Cuttlefish"],
    "tide:sun_emblem": [6.5, 50, 60, 85, "Sun Emblem"],
    "tide:uranias_pisces": [7.0, 180, 220, 350, "Urania's Pisces"],
    "tide:rainbow_aqualotl": [6.5, 15, 22, 40, "Rainbow Aqualotl"],
    "tide:nautilus": [6.0, 12, 20, 30, "Nautilus"],
    
    // Legendary tier
    "tide:coelacanth": [10.0, 140, 190, 270, "Coelacanth"],
    "tide:shooting_starfish": [9.5, 70, 85, 120, "Shooting Starfish"]
};



// ========== MASTER FISH DATABASE WITH CATEGORIES ==========
// Combines all fish databases with their category
function getFishData(fishId) {
    if (UNDERGROUND_FISH[fishId]) {
        return {
            data: UNDERGROUND_FISH[fishId],
            category: "underground"
        };
    }
    if (COLD_OCEAN_FISH[fishId]) {
        return {
            data: COLD_OCEAN_FISH[fishId],
            category: "cold_ocean"
        };
    }
    if (COLD_OCEAN_RARE_FISH[fishId]) {
        return {
            data: COLD_OCEAN_FISH_RARE[fishId],
            category: "cold_ocean_rare"
        };
    }    
    
    
    return null;
}

// ========== HELPER FUNCTIONS ==========

// Get fish size from NBT - Parse the JSON string directly
function getFishSize(itemStack) {
    try {
        var nbt = itemStack.getItemNbt();
        var nbtString = nbt.toJsonString();
        
        // Parse the JSON string to extract FishLength
        var fishLengthMatch = nbtString.match(/"FishLength":\s*([0-9.]+)d?/);
        
        if (fishLengthMatch && fishLengthMatch[1]) {
            var size = parseFloat(fishLengthMatch[1]);
            return size;
        }
        
        return null;
    } catch(e) {
        return null;
    }
}

// Calculate size multiplier based on where the fish size falls in its range
function getSizeMultiplier(fishSize, typicalLow, typicalHigh, recordHigh) {
    if (!fishSize) {
        return 1.0;
    }
    
    if (fishSize >= recordHigh) {
        return 2.5;
    } else if (fishSize >= typicalHigh) {
        var percent = (fishSize - typicalHigh) / (recordHigh - typicalHigh);
        return 1.3 + (percent * 0.7);
    } else if (fishSize >= typicalLow) {
        var percent = (fishSize - typicalLow) / (typicalHigh - typicalLow);
        return 1.0 + (percent * 0.3);
    } else {
        return 0.8;
    }
}

// Format size for display
function formatSize(size) {
    if (!size) return "unknown";
    if (size < 1) return (size * 10).toFixed(1) + "mm";
    return size.toFixed(1) + "cm";
}

// Calculate total price with category multiplier
function calculatePrice(fishData, fishSize, category) {
    var valueMultiplier = fishData[0];
    var typicalLow = fishData[1];
    var typicalHigh = fishData[2];
    var recordHigh = fishData[3];
    
    // Base price from fish type
    var basePrice = (valueMultiplier / BASE_MULTIPLIER) * BASE_COIN_VALUE;
    
    // Size multiplier
    var sizeMultiplier = getSizeMultiplier(fishSize, typicalLow, typicalHigh, recordHigh);
    
    // Category multiplier
    var categoryMultiplier = CATEGORY_MULTIPLIERS[category] || 1.0;
    
    // Final price = base × size × category
    return Math.round(basePrice * sizeMultiplier * categoryMultiplier);
}

// Get size category for message
function getSizeCategory(fishSize, typicalLow, typicalHigh, recordHigh) {
    if (!fishSize) return "";
    
    if (fishSize >= recordHigh) {
        return "§6§lRECORD SIZE ";
    } else if (fishSize >= typicalHigh) {
        return "§e§lLARGE ";
    } else if (fishSize >= typicalLow) {
        return "§a";
    } else {
        return "§7Small ";
    }
}

// ========== MAIN INTERACTION ==========
function interact(event) {
    var player = event.player;
    var npc = event.npc;
    var world = player.world;
    
    var heldItem = player.getMainhandItem();
    
    if (!heldItem || heldItem.isEmpty()) {
        npc.say("§eHold a fish in your hand to sell it to me!");
        return;
    }
    
    var itemId = heldItem.getName();
    
    // Get fish data with category
    var fishInfo = getFishData(itemId);
    
    if (!fishInfo) {
        npc.say("§cI don't buy " + heldItem.getDisplayName() + "!");
        return;
    }
    
    var fishData = fishInfo.data;
    var category = fishInfo.category;
    var fishName = fishData[4];
    
    // Get fish size
    var fishSize = getFishSize(heldItem);
    
    var price = calculatePrice(fishData, fishSize, category);
    var sizeCategory = getSizeCategory(fishSize, fishData[1], fishData[2], fishData[3]);
    var sizeText = formatSize(fishSize);
    
    var currency;
    try {
        currency = world.createItem(CURRENCY_ITEM, price);
    } catch(e) {
        currency = world.createItem(CURRENCY_FALLBACK, price);
    }
    
    heldItem.setStackSize(heldItem.getStackSize() - 1);
    player.giveItem(currency);
    
    // NPC message
    if (fishSize && fishSize >= fishData[3]) {
        npc.say("§6§l★ RECORD SIZE! ★");
        npc.say("§eSold " + fishName + " " + sizeCategory + sizeText + " for §6" + price + " coins§e!");
        player.message("§6§l★ You caught a RECORD SIZE fish! ★");
    } else if (fishSize && fishSize >= fishData[2]) {
        npc.say("§eSold " + fishName + " " + sizeCategory + sizeText + " for §6" + price + " coins§e!");
    } else if (!fishSize) {
        npc.say("§eSold " + fishName + " for §6" + price + " coins§e!");
    } else {
        npc.say("§eSold " + fishName + " " + sizeCategory + sizeText + " for §6" + price + " coins§e!");
    }
}

function role(event) {
    var npc = event.npc;
    npc.say("§eI buy all kinds of fish!");
    npc.say("§aHold a fish in your hand and right-click me to sell it.");
    npc.say("§7Larger fish are worth more coins!");
}