function init(event){
    var npc = event.npc;
    var item = npc.world.createItem("minecraft:air", 1);
     npc.getStats().setMaxHealth(200);
     npc.getStats().getRanged().setStrength(15);
     npc.getInventory().setDropItem(0, item, 1);
}

function died(event) {
    var killer = event.source; // the entity that killed this npc
    var world = event.npc.getWorld();
    var reward = world.createItem("minecraft:silence_armor_trim_smithing_template", 1);
    if (killer == null) return;

    // Case 1: Killed by player
    if (killer.getType() == 1) { // 1 = IPlayer
        killer.giveItem(reward);
    }

    // Case 2: Killed by drone (ICustomNpc)
    else if (killer.getType() == 2) { // 2 = ICustomNpc
        var owner = killer.getOwner(); // Returns IPlayer if tamed/companion
        if (owner != null) {
            owner.giveItem(reward);
        }
    }

    // Reset navigation
    event.npc.getAi().setNavigationType(0);
}