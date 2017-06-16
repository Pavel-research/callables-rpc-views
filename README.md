# RPC Views 

RPC views is designed to represent RAML Api descriptions as collections of the functions. The goal of this
representation is to allow client generators to be based on top of some unified mapping of HTTP interfaces into RPC calls,
and as the result to simplify their implementation.
 
---

There is a ton of possible mappings of HTTP into RPC world. Some of them are very generic and designed 
to do not loose information, some of them are doing a lot of assumptions about what aspects of HTTP interfaces are important.

*Request mapping:*

We convert uri parameters, request headers and request body into parameters of the function. 

Currently In case if endpoint has multiple request bodies we assume that these bodies represent one entity.   

*Response mapping:*

We map response body into return type of the function.
         
### Limitations
         
Payloads: At this moment only JSON payloads are handled.
Authentification: At this moment only basic authentification is supported.          
       
### Virtual Endpoints.
       
One often case in badly designed or too generic APIs is situation when one HTTP endpoint
represents several different operations        


### Api imports

This feature is not supported yet

### Usage


```typescript
import rpc=require("callables-rpc-views");
let module = main.module(api);
let type=module.functions()[0].parameters()[0].type();//get type of parameter
//execute function and print title of the result in the console.
module.functions()[0].call({id:614}).then(x=>{
  console.log(x.title)
});
```
