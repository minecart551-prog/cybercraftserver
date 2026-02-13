

function init(e) {
    var npc = e.npc;
    var display = npc.getDisplay();

    // --- Citizen faction ---
    npc.setFaction(17);
    npc.getAi().setAvoidsWater(true);


    // Male or female (50/50)
    var isMale = Math.random() < 0.5;

    if (isMale) {
        var maleSkins = [];
        for (var i = 1; i <= 34; i++) {
            var num = (i < 10 ? "0" + i : i);
            maleSkins.push("cyberpunkskins:textures/b/b" + num + ".png");
        }


        npc.getAi().setDoorInteract(2);
        npc.setMainhandItem(null);
        npc.getStats().setMaxHealth(20);
        display.setSkinTexture(randomFrom(maleSkins));
    } else {
        var femaleSkins = [];
        for (var i = 1; i <= 34; i++) {
            var num = (i < 10 ? "0" + i : i);
            femaleSkins.push("cyberpunkskins:textures/g/g" + num + ".png");
        }




        npc.getAi().setRetaliateType(1);
        npc.getAi().setDoorInteract(2);
        npc.getStats().setMaxHealth(20);
        display.setModel("customnpcs:customnpcalex");
        display.setSkinTexture(randomFrom(femaleSkins));
        npc.setMainhandItem(null);
    }
}



function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}