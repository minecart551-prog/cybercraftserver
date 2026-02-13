function init(event) {
    var npc = event.npc;
    npc.getAi().setNavigationType(1);
    npc.getStats().setMaxHealth(60);
    npc.getStats().getRanged().setStrength(7);
    npc.getStats().setRespawnTime(1800);
    npc.getStats().getRanged().setDelay(5, 5);
    npc.getStats().getRanged().setBurstDelay(1);
}

function died(event) {
    var killer = event.source; // the entity that killed this npc
    var world = event.npc.getWorld();

    if (killer == null) return;

    // Case 1: Killed by player
    if (killer.getType() == 1) { // 1 = IPlayer
        var reward = world.createItem("coins:coal_coin", 1);
        killer.giveItem(reward);
    }

    // Case 2: Killed by drone (ICustomNpc)
    else if (killer.getType() == 2) { // 2 = ICustomNpc
        var owner = killer.getOwner(); // Returns IPlayer if tamed/companion
        if (owner != null) {
            var reward2 = world.createItem("minecraft:emerald", 18);
            owner.giveItem(reward2);
        }
    }

    // Reset navigation
    event.npc.getAi().setNavigationType(0);
}
