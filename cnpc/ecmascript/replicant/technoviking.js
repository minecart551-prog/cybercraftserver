function init(event){
    var npc = event.npc;

     npc.getStats().setMaxHealth(55);
     npc.getStats().getRanged().setStrength(8);
     npc.getStats().getRanged().setAccuracy(85);
     npc.getStats().getRanged().setDelay(20, 20);
     npc.getStats().getRanged().setBurstDelay(1);
}