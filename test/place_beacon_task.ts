import * as BotTester from "messenger-bot-tester";
import { expect } from "chai";
import "mocha";
import * as sqlite3 from "sqlite3";

process.env.DATABASE_URL = ":memory:";
process.env.HEROKU_APP_NAME = "luzdeploy-staging";
process.env.FBGRAPHURL = "http://localhost:3100/v2.6";
import * as app from "../index";

describe("place beacon task", function() {
  // webHookURL points to where yout bot is currently listening 
  // choose a port for the test framework to listen on
  const botPort = 3000;
  const testingPort = 3100;
  const webHookURL = `http://localhost:${botPort}/fb-webhook`;
  const tester = new BotTester.default(testingPort, webHookURL);
  sqlite3.verbose();
  const db = new sqlite3.Database(process.env.DATABASE_URL);
  before(function(){
    app.startListening();
    // start your own bot here or having it running already in the background 
    // redirect all Facebook Requests to  and not https://graph.facebook.com/v2.6 
    return tester.startListening();
  });

  it("should give the user a new task", function(){
    const theScript = new BotTester.Script("1", "999");
    theScript.sendTextMessage("hi");  // mock user sending "hi"
    theScript.expectTextResponses([   // either response is valid
      "Hey!", 
      "Welcome",
    ]);
    return tester.runScript(theScript);
  });
})