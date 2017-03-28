/*******************************************************************************
 * Copyright (c) 2015 Cole Gleason
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *******************************************************************************/

function addNewFingerprintLocation(latLng, id) {
	var newFingerprintLocation = getNewFingerprintLocation({lat:latLng.lat(), lng:latLng.lng(), id:id});
	_currentFingerprintLocation = newFingerprintLocation;
	_currentLayer.fingerprintLocations[id] = newFingerprintLocation;
	$editor.trigger("dataChange");
	renderFingerprintLocation(newFingerprintLocation);
	showFingerprintLocationInfo(newFingerprintLocation);
}

function renderFingerprintsInLayer(layer) {
	for (var fingerprintId in layer.fingerprintLocations) {
		renderFingerprintLocation(layer.fingerprintLocations[fingerprintId], false);
	}
	_currentFingerprintLocation = null;
	updateFingerprintLocationTabUI();
}

function loadFingerprintLocationsInLayer(layer) {
	for (var fingerprintId in layer.fingerprintLocations) {
		loadBeacon(layer.fingerprintLocations[fingerprintId], false);
	}
	_currentFingerprintLocation = null;
	updateFingerprintLocationsTabUI();
}

$editor.on("derender", function(e, layer) {
	for (var fingerprintId in layer?layer.fingerprintLocations:_fingerprintLocationMarkers) {
		if (_fingerprintLocationMarkers[fingerprintId]) {
			_fingerprintLocationMarkers[fingerprintId].setMap(null);
		}
	}
	_currentFingerprintLocation = null;
});

function renderFingerprintLocation(fingerprintLocation, silent) {
	loadBeacon(fingerprintLocation, silent)
	_fingerprintLocationMarkers[fingerprintLocation.id].setMap(_map);
}

function loadBeacon(beacon, silent) {
	if (!_beaconMarkers[beacon.id]) {

		position = new google.maps.LatLng(beacon.lat, beacon.lng);

		var image = {
			size: new google.maps.Size(25, 25),
			anchor: new google.maps.Point(12.5, 12.5),
			url: "./img/round-blue.png"
		}
		var labelContent = beacon.id;

		if (typeof beacon.img != 'undefined') {
			image = {
				size: new google.maps.Size(50, 50),
				anchor: new google.maps.Point(25, 25),
				url: "./img/round-orange.png"
			}
			labelContent = null;
		}

		var beaconMarker = new MarkerWithLabel({
	    	position: position,
	    	draggable: false,
	    	raiseOnDrag: false,
	    	icon: image,
	    	shape: {
				coords: [12.5, 12.5, 12.5],
				type: "circle",
			},
			labelContent: labelContent,
			labelClass: "labels",
	    	labelAnchor: new google.maps.Point(10.5, 6.25)
	    });

	    beaconMarker.id = beacon.id;

		_beaconMarkers[beaconMarker.id] = beaconMarker;

		if(!silent) {
			beaconMarker.draggable = true;
			beaconMarker.addListener("click", function(e) {
				if (_currentBeaconEditState == BeaconEditState.Doing_Nothing) {
					_currentBeacon = _currentLayer.beacons[this.id];
					showBeaconInfo(_currentBeacon);
				};
			});

			beaconMarker.addListener("drag", function(e) {
				beaconMarker.setPosition(e.latLng);
				_currentLayer.beacons[this.id].lat = e.latLng.lat();
				_currentLayer.beacons[this.id].lng = e.latLng.lng();
			});
		}
	}
}

function showBeaconInfo(beacon) {
	position = new google.maps.LatLng(beacon.lat, beacon.lng);
	_beaconInfoWindow.setPosition(position);
	$NC.infoWindow.trigger("closeall");
	_beaconInfoWindow.open(_map);

	if (_beaconInfoEditorUUID == null) {
		_beaconInfoEditorUUID = document.getElementById("beacon-info-uuid");
		_beaconInfoEditorMajor = document.getElementById("beacon-info-major");
		_beaconInfoEditorMinor = document.getElementById("beacon-info-minor");
		_beaconInfoEditorPrd = document.getElementById("beacon-info-product-id");
		_beaconInfoEditorID = document.getElementById("beacon-info-beacon-id");
		_beaconInfoEditorEnablePOI = document.getElementById("beacon-info-enable-poi");
		_beaconInfoEditorPOIInfo = document.getElementById("beacon-info-poi-info");
		_beaconInfoEditorJSON = document.getElementById("beacon-info-task-json");

		_beaconInfoEditorUUID.addEventListener("keyup", function(e) {
			_lastUUID = this.value;
			_currentBeacon.uuid = this.value;
		});

		_beaconInfoEditorMajor.addEventListener("keyup", function(e) {
			_lastMajorID = this.value;
			_currentBeacon.major = this.value;
		});

		_beaconInfoEditorMinor.addEventListener("keyup", function(e) {
			if (this.value) {
				_lastMinorID = parseInt(this.value);
			};
			_currentBeacon.minor = this.value;
		});

		_beaconInfoEditorPrd.addEventListener("keyup", function(e) {
			_currentBeacon.prdid = this.value;
		});

		_beaconInfoEditorEnablePOI.addEventListener("change", function(e) {
			_currentBeacon.bePOI = this.checked;
			_beaconInfoEditorPOIInfo.disabled = !this.checked;
			if (this.checked) {
				_currentBeacon.bePOI = true;
			} else {
				_beaconInfoEditorPOIInfo.value = "";
				_currentBeacon[$i18n.k("poiInfo")] = "";
				_currentBeacon.bePOI = false;
			}
		});

		_beaconInfoEditorPOIInfo.addEventListener("keyup", function(e) {
			_currentBeacon[$i18n.k("poiInfo")] = this.value;
		});
	};

	spfe = findShortestPointFromEdge(position);

	beacon.edge = spfe.edge.id;

	_beaconInfoEditorJSON.value = beacon.edge;
	_beaconInfoEditorUUID.value = beacon.uuid;
	_beaconInfoEditorMajor.value = beacon.major;
	_beaconInfoEditorMinor.value = beacon.minor;
	_beaconInfoEditorPrd.value = beacon.prdid;
	_beaconInfoEditorID.value = beacon.id;
	_beaconInfoEditorEnablePOI.checked = beacon.bePOI;
	_beaconInfoEditorPOIInfo.disabled = !beacon.bePOI;
	_beaconInfoEditorPOIInfo.value = beacon[$i18n.k("poiInfo")];
}

function removeCurrentBeacon() {
	_beaconMarkers[_currentBeacon.id].setMap(null);
	delete _beaconMarkers[_currentBeacon.id];
	delete _currentLayer.beacons[_currentBeacon.id];
	_currentBeacon = null;
	_beaconInfoWindow.close();
}




function removeBeacon(index, minor) {
	var dataFile = _localizations[index].dataFile;
	var lines = dataFile.split("\n");

	var beacons = lines[0].split(": ")[1].split(",");
	for(var i = beacons.length-1; i >= 0; i--) {
		if (beacons[i] == minor) {
			beacons.splice(i,1);
		}
	}
	var header = "MinorID of "+beacons.length+" Beacon Used : "+beacons.join(",");
	for(var i = 1; i < lines.length; i++) {
		var line = lines[i];
		var items = line.split(",");
		if (items.length < 2) {
			continue;
		}
		var c = 0;
		for(var j = 0; j < parseInt(items[2]); j++) {
			if (parseInt(items[j*3+4]) == minor) {
				items.splice(j*3+3,3);
				c++;
			}
		}
		items[2] = parseInt(items[2])-c;
		line = items.join(",");
		lines[i] = line;
	}
	for(var i = lines.length-1; i>=0; i--) {
		var items = lines[i].split(",");
		if (parseInt(items[2]) < 2) {
			lines.splice(i,1);
		}
	}

	lines[0] = header;
	 _localizations[index].dataFile = lines.join("\n");
}

function updateBeaconTabUI() {
	$("#beacon-info-edge-chooser").empty();

	var edges = [];
	for(var l in _layers) {
		var layer = _layers[l];
		for(var e in layer.edges) {
			edges.push(layer.edges[e]);
		}
	}
	console.log(edges);
	edges = edges.sort(function(a,b){return a.id-b.id;});
	console.log(edges);
	for(var i in edges) {
		var e = edges[i].id;
		var $o = $("<option>").val(e).text(e).appendTo($("#beacon-info-edge-chooser"));
		$o[0]._edge = edges[i];
	}
}


function saveFingerprintLocationsCSV() {
	result = "id,floor,lat,lng\n";
	for(l in _layers) {
		_currentLayer = _layers[l];
		loadFingerprintLocationsInLayer(_layers[l], true);
		for(fingerprintId in _currentLayer.fingerprintLocations) {
            var fingerprintLocation = _currentLayer.fingerprintLocations[fingerprintLocation];
			position = new google.maps.LatLng(fingerprintLocation.lat, fingerprintLocation.lng);
			result += [fingerprintId, l, fingerprintLocation.lat, fingerprintLocation.lng].join(",")+"\n";
		}
	}
	downloadFileType(result, "FignerprintLocations.csv", ["text/plain", "text"]);
}