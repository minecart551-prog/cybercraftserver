//KEY REGISTRATION BLOCK SCRIPT
// Works with regular item: lockandblock:key

var guiRef = null;
var lastBlock = null;
var lastAPI = null;
var searchQuery = "";

function interact(t){
    var player = t.player;
    var handItem = player.getMainhandItem();
    var worldData = t.block.world.getStoreddata();
    
    lastBlock = t.block;
    lastAPI = t.API;
    
    // Initialize world data with merged structure
    if(!worldData.has("keyRegistry")) worldData.put("keyRegistry", JSON.stringify({}));
    if(!worldData.has("keyCounter")) worldData.put("keyCounter", "0");
    
    var keyRegistry = JSON.parse(worldData.get("keyRegistry"));
    
    // Register key if holding one
    if(handItem && !handItem.isEmpty() && handItem.getName() == "lockandblock:key"){
        var keyName = handItem.getDisplayName();
        var existingKeyID = getKeyID(handItem.getItemNbt());
        
        if(existingKeyID){
            player.message("§cThis key is already registered!");
            player.message("§eKey ID: §f" + existingKeyID);
            // Don't open GUI, just reject
            return;
        }
        
        // Generate new sequential ID and create key
        var keyCounter = parseInt(worldData.get("keyCounter")) + 1;
        var keyID = keyCounter.toString();
        worldData.put("keyCounter", keyID);
        
        var itemNbt = handItem.getItemNbt();
        var nbtObj = itemNbt ? JSON.parse(cleanNbtJson(itemNbt.toJsonString())) : {id:"lockandblock:key", Count:1};
        if(!nbtObj.tag) nbtObj.tag = {};
        nbtObj.tag.RegisteredKeyID = keyID;
        nbtObj.Count = 1;
        
        player.setMainhandItem(player.world.createItemFromNbt(t.API.stringToNbt(JSON.stringify(nbtObj))));
        
        player.message("§aAssigned Key ID: §f" + keyID);
        player.message("§aKey registered: §f" + keyName);
        
        // Add to merged registry with array for multiple doors
        keyRegistry[keyID] = {
            name: keyName,
            id: keyID,
            doorCoords: [],
            firstBuyer: null,
            lastUser: null
        };
        worldData.put("keyRegistry", JSON.stringify(keyRegistry));
    }
    
    renderKeyListGUI(player, lastAPI);
}

function getKeyID(itemNbt){
    if(!itemNbt) return null;
    try {
        var nbtObj = JSON.parse(cleanNbtJson(itemNbt.toJsonString()));
        return nbtObj.tag && nbtObj.tag.RegisteredKeyID ? nbtObj.tag.RegisteredKeyID : null;
    } catch(e) {
        return null;
    }
}

function cleanNbtJson(nbtString){
    if(!nbtString) return "{}";
    return nbtString.replace(/:\s*(-?\d+)[bBsSlLfFdD]/g, ": $1")
                    .replace(/:\s*(-?\d+\.\d+)[fFdD]/g, ": $1");
}

function renderKeyListGUI(player, api){
    var worldData = player.world.getStoreddata();
    var keyRegistry = JSON.parse(worldData.get("keyRegistry"));
    
    // Convert registry object to array for filtering/display
    var keyList = [];
    for(var keyID in keyRegistry){
        keyList.push(keyRegistry[keyID]);
    }
    
    // Filter keys based on search query
    var filteredKeys = keyList;
    if(searchQuery && searchQuery.length > 0){
        var lowerQuery = searchQuery.toLowerCase();
        filteredKeys = [];
        for(var i = 0; i < keyList.length; i++){
            var key = keyList[i];
            var keyNameMatch = key.name.toLowerCase().indexOf(lowerQuery) !== -1;
            var firstBuyerMatch = key.firstBuyer && key.firstBuyer.toLowerCase().indexOf(lowerQuery) !== -1;
            var lastUserMatch = key.lastUser && key.lastUser.toLowerCase().indexOf(lowerQuery) !== -1;
            
            if(keyNameMatch || firstBuyerMatch || lastUserMatch){
                filteredKeys.push(key);
            }
        }
    }
    
    guiRef = api.createCustomGui(300, 220, 0, false, player);
    
    guiRef.addLabel(0, "§l§nRegistered Keys", 10, -115, 1.0, 1.0);
    guiRef.addLabel(4, "Search:", 10, -100, 1.0, 1.0);
    guiRef.addTextField(5, 50, -100, 100, 18).setText(searchQuery);
    guiRef.addButton(6, "Go", 155, -100, 30, 18);
    
    if(filteredKeys.length == 0){
        var message = searchQuery ? "§7No keys found matching '" + searchQuery + "'" : "§7No keys registered yet";
        guiRef.addLabel(3, message, 10, -75, 1.0, 1.0);
    } else {
        var yPos = -75;
        var displayLimit = Math.min(filteredKeys.length, 8);
        
        for(var i = 0; i < displayLimit; i++){
            var key = filteredKeys[i];
            
            // Build key name with firstBuyer and lastUser in format: name (ID: x) buyer, user
            var keyNameText = "§e" + key.name + " §7(ID: " + key.id + ") §f";
            
            // Add firstBuyer (or "null" if none)
            if(key.firstBuyer){
                keyNameText += key.firstBuyer;
            } else {
                keyNameText += "null";
            }
            
            // Add comma separator
            keyNameText += "§7, §f";
            
            // Add lastUser (or "null" if none)
            if(key.lastUser){
                keyNameText += key.lastUser;
            } else {
                keyNameText += "null";
            }
            
            // Build door display text
            var doorText = "";
            if(!key.doorCoords || key.doorCoords.length == 0){
                doorText = "§7Doors: §cNone paired";
            } else if(key.doorCoords.length == 1){
                doorText = "§7Door: §f" + key.doorCoords[0];
            } else {
                // Join multiple coordinates with | separator
                doorText = "§7Doors: §f" + key.doorCoords.join(" §7|§f ");
            }
            
            // Use keyID directly for button ID (converted to number)
            var buttonID = 100 + parseInt(key.id);
            
            guiRef.addButton(buttonID, "§cX", 10, yPos, 15, 15);
            guiRef.addLabel(10 + i, keyNameText, 30, yPos, 0.7, 0.7);
            guiRef.addLabel(30 + i, doorText, 30, yPos + 8, 0.6, 0.6);
            yPos += 20;
        }
        
        if(filteredKeys.length > 8){
            guiRef.addLabel(100, "§7... and " + (filteredKeys.length - 8) + " more", 30, yPos, 0.7, 0.7);
        }
    }
    
    guiRef.addButton(1, "Close", 235, 75, 50, 20);
    player.showCustomGui(guiRef);
}

function deleteKey(keyID, player, api){
    var worldData = player.world.getStoreddata();
    var keyRegistry = JSON.parse(worldData.get("keyRegistry"));
    
    if(keyRegistry[keyID]){
        var deletedKey = keyRegistry[keyID];
        
        // Remove key from registry (this also removes all door pairings)
        delete keyRegistry[keyID];
        worldData.put("keyRegistry", JSON.stringify(keyRegistry));
        
        player.message("§cDeleted key: §f" + deletedKey.name + " §7(ID: " + keyID + ")");
        if(deletedKey.doorCoords && deletedKey.doorCoords.length > 0){
            player.message("§7Unpaired from " + deletedKey.doorCoords.length + " door(s)");
        }
        
        // Re-render GUI with updated list (keep search query)
        renderKeyListGUI(player, api);
    }
}

function customGuiButton(t){
    var player = t.player;
    
    if(t.buttonId == 1){
        player.closeGui();
        guiRef = null;
        searchQuery = "";
        return;
    }
    
    if(t.buttonId == 6){
        // Search button
        var gui = t.gui;
        if(gui){
            var searchField = gui.getComponent(5);
            if(searchField){
                searchQuery = searchField.getText();
                renderKeyListGUI(player, lastAPI);
            }
        }
        return;
    }
    
    if(t.buttonId >= 100){
        // Before deleting, preserve the current search query from the text field
        var gui = t.gui;
        if(gui){
            var searchField = gui.getComponent(5);
            if(searchField){
                searchQuery = searchField.getText();
            }
        }
        
        // Extract keyID from buttonID
        var keyID = (t.buttonId - 100).toString();
        deleteKey(keyID, player, lastAPI);
    }
}

function customGuiClosed(t){
    guiRef = null;
    searchQuery = "";
}