class PlaceBeaconsTask extends Task {
	constructor() {
		super();
		this.type = "place_beacon";
		this.estimatedTime = "10 min";
		this.startState = "pickup";
		this.doneState = "done";
		this.states = {
			"pickup": {
				instructions: [
				{
					"wait": 0,
					"message": {
						"text": "In this task you will place beacons in the environment that will be used by people with visual impairments to navigate the building."
					}
				},
				{
					"wait": 2,
					"message": {
						"text": "Here are the steps you will need to complete:\n1. Go to the Supply Station (GHC 5th floor entrance) and grab as many beacons as you are willing to place.\nPlease tell me when you are there."
					}
				},
				],
				complete: function() {
					this.transition('which')
				},
				transitions: ["which"]
			}, 
			{
				name: "which",
				instructions: [
				{
					"wait": 0,
					"message": {
						"text": "Great! Once you have beacons, please just reply with how many you have!"
					}
				}
				],
				transitions: ["place"]
			},
			{
				name: "place",
				instructions: [
				{
					"wait": 0,
					"message": {
						"attachment": {
							"type": "template",
							"payload": {
								"template_type": "button",
								"text": "3. Place the beacon on the wall about 10 feet off the ground. Try to make it look neat.\n4. Tell me when you are done!",
								"buttons": [{
									"type":"web_url", 
									"title": "Open Map", 
									"url": "http://hulop.qolt.cs.cmu.edu/mapeditor/?advanced&hidden&beacon={beacon}"
								}]
							}
						}
					}
				}
				],
				transitions: ["which", "done"]
			}];
		}
	}
