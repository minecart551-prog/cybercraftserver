// Global variables
var tickCounter = 0;

function tick(event) {
    tickCounter++;

    // Only check once every 40 ticks (~2 seconds)
    if (tickCounter % 40 != 0) return;

    var player = event.player;
    var mount = player.getMount();

    if (mount != null) {
        var inv = player.getInventory().getItems();
        var hasRestrictedItem = false;

        for (var i = 0; i < inv.length; i++) {
            var item = inv[i];
            if (item != null) {
                var id = item.getName();
                if (id == "minecraft:sugar") {
                    hasRestrictedItem = true;
                    item.setStackSize(0); // remove item
                    player.message("§cYou cannot carry sugar while driving.");
                }
            }
        }
    }
}