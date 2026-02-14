var skinAvail = 34;
var rewardItem = "coins:coal_coin";  
var rewardCount = 20;

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

function init(e){
    var npc = e.npc;
    var item = npc.world.createItem(rewardItem, rewardCount);
    var display = npc.getDisplay();
    
    npc.getStats().setMaxHealth(400);
    npc.getStats().getRanged().setStrength(25);
    npc.getStats().getRanged().setAccuracy(70);
    npc.getInventory().setDropItem(1, item, 100);
    
    var isMale = Math.random() < 0.5;
    if (isMale) {
        var maleSkins = [];
        for (var i = 1; i <= skinAvail; i++) {
            var num = (i < 10 ? "0" + i : i);
            maleSkins.push("cyberpunkskins:textures/b/b" + num + ".png");
        } 
        display.setSkinTexture(randomFrom(maleSkins));    
    } else {
        var femaleSkins = [];
        for (var i = 1; i <= skinAvail; i++) {
            var num = (i < 10 ? "0" + i : i);
            femaleSkins.push("cyberpunkskins:textures/g/g" + num + ".png");   
        } 
        display.setSkinTexture(randomFrom(femaleSkins));  
    }
}

function died(event) {
    var npc = event.npc;
    var npcData = npc.getStoreddata();
    
    // Check if this bounty belongs to a contract
    if (!npcData.has("owner")) {
        return; // Not a contract bounty
    }
    
    var ownerName = npcData.get("owner");
    var wdata = npc.getWorld().getStoreddata();
    
    var contracts = getContracts(wdata);
    
    // Get the killer
    var killer = event.source;
    var killerName = null;
    if (killer && killer.getName) {
        killerName = killer.getName();
    }
    
    // Check if killer is the contract owner
    var isOwnerKill = (killerName === ownerName);
    
    // Decrease remaining count only if owner killed it OR if killed by non-player (environment, etc.)
    if (contracts[ownerName]) {
        var contractData = contracts[ownerName];
        
        // Only decrease if:
        // 1. The owner killed it (isOwnerKill = true), OR
        // 2. No player killed it (killerName = null, meaning environment/other)
        if (isOwnerKill || killerName === null) {
            // Safety check: only decrease if remaining is greater than 0
            if (contractData.remaining > 0) {
                contractData.remaining = contractData.remaining - 1;
            } else {
                contractData.remaining = 0;
            }
            
            saveContracts(wdata, contracts);
            
            // Notify owner if online
            var players = npc.getWorld().getAllPlayers();
            for (var i = 0; i < players.length; i++) {
                if (players[i].getName() === ownerName) {
                    var owner = players[i];
                    
                    if (contractData.remaining <= 0) {
                        owner.message("§aContract complete! Return for a new one.");
                    } else {
                        owner.message("§a" + contractData.remaining + " targets remaining.");
                    }
                    break;
                }
            }
        } else {
            // Someone else killed the bounty - notify owner if online
            var players = npc.getWorld().getAllPlayers();
            for (var i = 0; i < players.length; i++) {
                if (players[i].getName() === ownerName) {
                    var owner = players[i];
                    owner.message("§c⚠ Someone else killed one of your targets!");
                    break;
                }
            }
        }
    }
}

function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}