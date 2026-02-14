// --- Contract giver NPC ---

// === CONFIGURATION ===
var maxEnemy = 1; // Maximum number of enemies per contract

var availableBounties = [
    { tab: 1, name: "B1" }

];

var contractCoords = [
    { x: 2330, y: -50, z: 1058 },
    { x: 2056, y: -50, z: 868 },
    { x: 2207, y: -50, z: 1653 },
    { x: 2215, y: -50, z: 1772 },
    { x: 2192, y: -50, z: 1857 },
    { x: 2397, y: -39, z: 2152 },
    { x: 2186, y: -50, z: 463 },
    { x: 2574, y: -50, z: 246 },
    { x: 2182, y: -50, z: 98 },
    { x: 2476, y: -50, z: -92 },
    { x: 2323, y: -49, z: -305 },
    { x: 2063, y: -50, z: -301 },
    { x: 1954, y: -45, z: -281 },
    { x: 1885, y: -50, z: -176 },
    { x: 1774, y: -50, z: -169 },
    { x: 1516, y: -45, z: -333 },
    { x: 1398, y: -40, z: -327 },
    { x: 1142, y: -40, z: -317 },
    { x: 1103, y: -24, z: -259 },
    { x: 1085, y: -24, z: -221 },
    { x: 1062, y: -29, z: -180 },
    { x: 1096, y: -24, z: -231 },
    { x: 1813, y: -40, z: -1100 },
    { x: 2540, y: -50, z: -647 }
];

function getContracts(wdata) {
    if (!wdata.has("allContracts")) {
        return {};
    }
    try {
        return JSON.parse(wdata.get("allContracts"));
    } catch (e) {
        return {};
    }
}

function saveContracts(wdata, contracts) {
    wdata.put("allContracts", JSON.stringify(contracts));
}

function interact(event) {
    var player = event.player;
    var wdata = event.npc.getWorld().getStoreddata();
    var playerName = player.getName();
    
    var contracts = getContracts(wdata);
    
    // Check if player has active contract
    if (contracts[playerName]) {
        var contractData = contracts[playerName];
        var remaining = contractData.remaining;
        var x = contractData.x;
        var y = contractData.y;
        var z = contractData.z;
        
        if (remaining <= 0) {
            // Contract complete, clean up
            delete contracts[playerName];
            saveContracts(wdata, contracts);
            player.message("§aYour contract is complete! Here's a new one.");
        } else {
            // Show active contract info
            player.message("§eActive contract location: §6(" + x + ", " + y + ", " + z + ")");
            player.message("§cTargets remaining: §e" + remaining);
            return;
        }
    }
    
    // --- Give new contract ---
    var idx = Math.floor(Math.random() * contractCoords.length);
    var coord = contractCoords[idx];
    var numTargets = Math.floor(Math.random() * maxEnemy) + 1; // Random 1 to maxEnemy
    
    for (var i = 0; i < numTargets; i++) {
        var bounty = availableBounties[Math.floor(Math.random() * availableBounties.length)];
        var entity = event.npc.getWorld().spawnClone(coord.x, coord.y, coord.z, bounty.tab, bounty.name);
        
        // Mark bounty with player name
        if (entity && entity.getStoreddata) {
            entity.getStoreddata().put("owner", playerName);
        }
    }
    
    // Store contract data in the main contracts object
    contracts[playerName] = {
        remaining: numTargets,
        x: coord.x,
        y: coord.y,
        z: coord.z
    };
    saveContracts(wdata, contracts);
    
    event.npc.say(
        "§aContract assigned: §e" + numTargets + " targets§r at §e(" +
        coord.x + ", " + coord.y + ", " + coord.z + ")§r"
    );
}