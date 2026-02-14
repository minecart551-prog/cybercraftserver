function init(e){
var npc=e.npc;
var gun = npc.world.createItem("tacz:modern_kinetic_gun",1);
gun.getNbt().putString("GunId","cyber_armorer:ajax");
npc.setMainhandItem(gun);

}