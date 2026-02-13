function init(e) {
    var npc = e.npc;
    // If not set before, initialize
    if (!npc.storeddata.has("reseted")) {
        npc.storeddata.put("reseted", 0);
    }

    var reseted = npc.storeddata.get("reseted");

    if (npc.getFaction().getId() == 15 && reseted == 0) {
        npc.storeddata.put("reseted", 1); // store persistently
        npc.reset();
    } 
    else if (npc.getFaction().getId() == 15 && reseted == 1) {
        var pos = npc.getPos();
        npc.getWorld().spawnClone(pos.getX(), pos.getY()+1, pos.getZ(), 3, "CitizenPolice");
        npc.despawn();
    }
}