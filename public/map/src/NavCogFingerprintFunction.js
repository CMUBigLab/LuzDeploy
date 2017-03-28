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
    if (_currentLayer.fingerprintLocations == undefined) {
        _currentLayer.fingerprintLocations = {};
    }
	_currentFingerprintLocation = newFingerprintLocation;
	_currentLayer.fingerprintLocations[id] = newFingerprintLocation;
	$editor.trigger("dataChange");
	renderFingerprintLocation(newFingerprintLocation);
}

function renderFingerprintsInLayer(layer) {
	for (var fingerprintId in layer.fingerprintLocations) {
		renderFingerprintLocation(layer.fingerprintLocations[fingerprintId], false);
	}
	_currentFingerprintLocation = null;
}

function loadFingerprintLocationsInLayer(layer) {
	for (var fingerprintId in layer.fingerprintLocations) {
		loadFingerprintLocation(layer.fingerprintLocations[fingerprintId], false);
	}
	_currentFingerprintLocation = null;
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
	loadFingerprintLocation(fingerprintLocation, silent)
	_fingerprintLocationMarkers[fingerprintLocation.id].setMap(_map);
}

function loadFingerprintLocation(fingerprintLocation, silent) {
	if (!_fingerprintLocationMarkers[fingerprintLocation.id]) {

		position = new google.maps.LatLng(fingerprintLocation.lat, fingerprintLocation.lng);

		var image = {
			size: new google.maps.Size(25, 25),
			anchor: new google.maps.Point(12.5, 12.5),
			url: "./img/round-green.png"
		}

		var fingerprintMarker = new MarkerWithLabel({
	    	position: position,
	    	draggable: false,
	    	raiseOnDrag: false,
	    	icon: image,
	    	shape: {
				coords: [12.5, 12.5, 12.5],
				type: "circle",
			},
			labelContent: fingerprintLocation.id,
			labelClass: "labels",
	    	labelAnchor: new google.maps.Point(10.5, 6.25)
	    });

	    fingerprintMarker.id = fingerprintLocation.id;

		_fingerprintLocationMarkers[fingerprintMarker.id] = fingerprintMarker;

		if(!silent) {
			fingerprintMarker.draggable = true;
			fingerprintMarker.addListener("click", function(e) {
				if (_currentFingerprintEditState == FingerprintEditState.Doing_Nothing) {
					_currentFingerprintLocation = _currentLayer.fingerprintLocations[this.id];
				};
			});

			fingerprintMarker.addListener("drag", function(e) {
				fingerprintMarker.setPosition(e.latLng);
				_currentLayer.fingerprintLocations[this.id].lat = e.latLng.lat();
				_currentLayer.fingerprintLocations[this.id].lng = e.latLng.lng();
			});
		}
	}
}

function removeCurrentFingerprintLocation() {
	_fingerprintLocationMarkers[_currentFingerprintLocation.id].setMap(null);
	delete _fingerprintLocationMarkers[_currentFingerprintLocation.id];
	delete _currentLayer.fingerprintLocations[_currentFingerprintLocation.id];
	_currentFingerprintLocation = null;
}

function saveFingerprintLocations() {
	result = "id,lat,lon,floor\n";
	for(l in _layers) {
		for(fingerprintId in _layers[l].fingerprintLocations) {
            var fingerprintLocation = _layers[l].fingerprintLocations[fingerprintId];
			result += [fingerprintId, fingerprintLocation.lat, fingerprintLocation.lng, l].join(",")+"\n";
		}
	}
	downloadFileType(result, "FignerprintLocations.csv", ["text/plain", "text"]);
}