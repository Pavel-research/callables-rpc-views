"use strict";
import chai = require("chai");
import  mocha=require("mocha")
import rp=require("raml-1-parser");
import json=require("json2raml-loader");
let assert = chai.assert;
import path=require("path")
import fs=require("fs")
import ri=require("raml1-domain-model")
import main=require("../src/main");
function loadApi(name: string): ri.Api {
    var rs = <rp.api10.Api>rp.loadRAMLSync(path.resolve(__dirname, "../../tests/raml/" + name + ".raml"), []);
    var s = rs.expand(true).toJSON({serializeMetadata: false});
    var result = json.loadApi(s);
    return result;
}
function loadLibrary(name: string) {
    var rs = <rp.api10.Api>rp.loadRAMLSync(path.resolve(__dirname, "../../tests/raml/" + name + ".raml"), []);
    var s = rs.toJSON({serializeMetadata: false});
    var result = json.loadLibrary(s);
    return result;
}

describe("structure tests", function () {
    it("test0", function () {
        var l = loadApi("test1");
        let module = main.module(l);
        assert(module.functions().length == 1);
        let f = module.functions()[0];
        let parameters = f.parameters();
        assert(parameters.length == 4);
        var pl = parameters.map(x => x.location()).join(',');
        assert(pl == "uri,query,headers,body");
        var returnT = f.returnType().name();
        assert(returnT == "Class")
        var returnT = parameters[0].type().name();
        assert(returnT == "string")
        assert(parameters[0].name() == "id")
        var id = f.id();
        assert(id == "updateRepo");
    })
    it("test1", function () {
        var l = loadApi("test2");
        let module = main.module(l);
        assert(module.functions().length == 1);
        let f = module.functions()[0];
        let parameters = f.parameters();
        assert(parameters.length == 4);
        var pl = parameters.map(x => x.location()).join(',');
        assert(pl == "uri,query,headers,body");
        var returnT = f.returnType().name();
        assert(returnT == "Class")
        var returnT = parameters[0].type().name();
        assert(returnT == "string")
        assert(parameters[0].name() == "id")
        var id = f.id();
        assert(id == "hello.{id}.put");
    })
    // it("test2", function () {
    //     var l = loadApi("test3");
    //     let module = main.module(l);
    //     assert(module.functions().length==2);
    // })
    it("test3", function (done) {
        var l = loadApi("xkcd");
        let module = main.module(l);

        module.functions()[0].call({}).then(x=>{
            done()
        });
    })
    it("test4", function (done) {
        var l = loadApi("xkcd2");
        let module = main.module(l);

        module.functions()[0].call({id:614}).then(x=>{
            assert(x.title=="Woodpecker")
            done()
        });
    })
    it("test5", function (done) {
        var l = loadApi("xkcd2");
        let module = main.module(l);

        var rs=module.functions()[0].validateParameters({})
        assert(!rs.isOk);
        assert(rs.missedRequiredParameters[0]=='id')
        var rs=module.functions()[0].validateParameters({id:3})
        assert(!rs.isOk);
        assert(rs.missedRequiredParameters.length==0);
        assert(!rs.errors['id'].isOk())
        done();
    })
})
