function init(event){
    var npc = event.npc;

     npc.getStats().setMaxHealth(20);
     npc.getStats().getRanged().setStrength(4);
     npc.getStats().getRanged().setDelay(17, 17);
     npc.getStats().getRanged().setBurstDelay(1);
     var coal = npc.world.createItem("minecraft:coal", 1);
     var beans = npc.world.createItem("minecraft:cocoa_beans", 1);
     var milk = npc.world.createItem("farmersdelight:milk_bottle", 1);
     var mug = npc.world.createItem("yuushya:mug", 1);
     npc.getInventory().setDropItem(1, coal, 30);
     npc.getInventory().setDropItem(2, beans, 30);
     npc.getInventory().setDropItem(3, milk, 30);
     npc.getInventory().setDropItem(4, mug, 30);

}