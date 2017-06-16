import rti=require("raml1-domain-model")
import request=require("superagent")
export import Parameter=rti.Parameter;
export import Type=rti.Type;
export import Annotation=rti.IAnnotation;

export interface Par {
    name: string
    location: string
    value: any
}

export interface ValidationReport{

    isOk:boolean

    missedRequiredParameters: string[]
    errors:{ [name:string]:rti.types.IStatus}
}
export interface Request {

    url: string
    method: string
    parameters: Par[];

    auth?: {
        user?: string
        password?: string
    }
}

export class RequestExecutor {

    execute(r: Request): Promise<any> {
        var url = r.url;
        return new Promise(function (resolve, reject) {
            r.parameters.forEach(x => {
                if (x.location == "uri") {

                    var pm = "{" + x.name + "}";
                    var i = url.indexOf(pm);
                    if (i != -1) {
                        var c = x.value;
                        if (!c) {
                            c = "";
                        }
                        url = url.substring(0, i) + c + url.substring(i + pm.length);
                    }
                }
            })
            var rr = request(r.method.toUpperCase(), url);
            r.parameters.forEach(x => {
                if (x.location == "query") {
                    var c: any = {};
                    if (x.value) {
                        c[x.name] = x.value;
                        rr = rr.query(c);
                    }
                }
                if (x.location == "headers") {
                    if (x.value) {
                        rr = rr.set(x.name, x.value);
                    }
                }
                if (x.location == "body") {
                    if (x.value) {
                        rr = rr.send(x.value);
                    }
                }
            })
            if (r.auth) {
                rr.auth(r.auth.user, r.auth.password);
            }
            rr.end((err: any, res: request.Response) => {
                if (res) {
                    var body = res.body;
                    resolve(body);
                }
                else {
                    if (err) {
                        reject(err)
                    }
                }
            })
        });
    }
}

export interface Module {
    title(): string
    functions(): CallableFunction[]
    annotations(): Annotation[]
    securitySchemas(): rti.SecuritySchemeDefinition[]


    settings(): any
}

export interface CallableFunction {

    parameters(): Parameter[];

    id(): string

    displayName(): string

    returnType(): Type

    annotations(): Annotation[]

    call(parameters: {[pname: string]: any}): Promise<any>

    module(): Module;

    securedBy(): rti.SecuredBy[]

    validateParameters(parameters: {[pname: string]: any}): ValidationReport
}

export interface HTTPSettings {
    baseUri?: string

    user?: string
    password?: string
    accessToken?: string
}

export class BasicHTTPModule implements Module {

    executor: RequestExecutor = new RequestExecutor();


    constructor(private api: rti.Api) {
        if (api.baseUri()) {
            this._settings.baseUri = api.baseUri();
        }
    }

    private _settings: HTTPSettings = {};

    settings(): HTTPSettings {
        return this._settings
    }

    securitySchemas(): rti.SecuritySchemeDefinition[] {
        return this.api.securitySchemes();
    }

    annotations() {
        return this.api.annotations();
    }

    _methods: CallableFunction[];

    functions(): CallableFunction[] {
        if (!this._methods) {
            this._methods = [];
            this.api.allMethods().forEach(m => {
                var c = callable(this, m);
                this._methods.push(c);
                var views = m.annotation("views");
                if (views && Array.isArray(views)) {
                    var vals: ViewDescription[] = views;
                    vals.forEach(v => {
                        this._methods.push(new VirtualCallable(c, v))
                    });
                }
            })
        }
        return this._methods;
    }

    title() {
        return this.api.title();
    }
}

interface ViewDescription {
    id: string
    fixedParameters: {[name: string]: any}
    displayName?: string
    description?: string
}

class VirtualCallable implements CallableFunction {


    constructor(private  _c: CallableFunction, private viewDescription: ViewDescription) {

    }

    id() {
        return this.viewDescription.id
    }

    displayName() {
        if (this.viewDescription.displayName) {
            return this.viewDescription.displayName;
        }
        return this.id();
    }

    annotations() {
        return this._c.annotations();
    }

    parameters() {
        return this._c.parameters().filter(x => !this.viewDescription.fixedParameters[x.name()]);
    }

    securedBy() {
        return this._c.securedBy();
    }

    returnType() {
        return this._c.returnType();
    }

    module() {
        return this._c.module();
    }

    call(pars: any) {
        var rs = this.fillParameters(pars);
        return this._c.call(rs);
    }

    private fillParameters(pars: any) {
        var rs = {};
        Object.keys(pars).forEach(x => {
            rs[x] = pars[x];
        });
        Object.keys(this.viewDescription.fixedParameters).forEach(x => {
            rs[x] = this.viewDescription.fixedParameters[x];
        })
        return rs;
    }

    validateParameters(parameters: {[pname: string]: any}): ValidationReport {
        var rs = this.fillParameters(parameters);
        return this._c.validateParameters(rs);
    }
}

class CallableImpl implements CallableFunction {

    constructor(private _mod: Module, private method: rti.Method) {

    }

    _id: string;

    securedBy(): rti.SecuredBy[] {
        return this.method.securedBy();
    }

    validateParameters(parameters: {[pname: string]: any}): ValidationReport {
        var result = true;
        var missedRequired:string[]=[]
        var errors:{[name:string]:rti.types.IStatus}={}
        this.parameters().forEach(x => {
            var vl = parameters[x.name()];
            if (x.required()) {
                if (vl == null || vl == undefined) {
                    missedRequired.push(x.name());
                    result = false;
                }
            }
            if (vl != null && vl != undefined) {
                var status=x.type().validate(vl);
                var err = status.isError();
                if (err) {
                    errors[x.name()]=status;
                    result = false;
                }
            }
        })
        return {
            isOk:result,
            missedRequiredParameters:missedRequired,
            errors:errors
        };
    }

    id() {
        if (this._id) {
            return this._id;
        }
        var idA = this.method.annotation("id");
        if (idA) {
            this._id = idA;
        }
        if (!this._id) {
            var vv = this.method.resource().fullRelativeUrl();
            var res = ""
            for (var i = 0; i < vv.length; i++) {
                var c = vv[i];
                if (c == '/') {
                    c = '.'
                }
                res += c;
            }
            this._id = res.substring(1) + "." + this.method.method();
        }
        return this._id;
    }

    displayName(): string {
        return this.method.displayName();
    }

    private _return: Type;
    private returnsNull: boolean;
    private _parameters: Parameter[];

    returnType() {
        if (this._return || this.returnsNull) {
            return this._return;
        }
        this.method.responses().forEach(x => {
            if (x.code().startsWith("2")) {
                x.bodies().forEach(b => {
                    if (b.mimeType().indexOf('json') != -1) {
                        //this is our preferred response;
                        this._return = normalizeType(b.type());
                    }
                })
            }
        })
        if (!this._return) {
            this.returnsNull = true;
        }
        return this._return;
    }

    annotations() {
        return this.method.annotations();
    }

    parameters() {
        if (this._parameters) {
            return this._parameters;
        }
        this._parameters = [];
        this.method.parameters().forEach(x => {
            var rt = normalizeType(x.type());
            this._parameters.push({
                name(){
                    return x.name();
                },
                annotation(n: string){
                    return x.annotation(n);
                }
                ,
                location(){
                    return x.location();
                },
                type(){
                    return rt;
                },
                required(){
                    return x.required();
                },
                annotations(){
                    return x.annotations();
                }
            });
        })
        this.method.bodies().forEach(b => {
            if (b.mimeType().indexOf('json') != -1) {
                var rt = normalizeType(b.type());
                this._parameters.push({
                    name(){
                        return "body"
                    },
                    annotation(n: string){
                        return b.annotation(n)
                    }
                    ,
                    location(){
                        return "body"
                    },
                    type(){
                        return rt;
                    },
                    required(){
                        return true;
                    },
                    annotations(){
                        return b.annotations();
                    }
                });

            }
        })
        return this._parameters;
    }

    module() {
        return this._mod;
    }

    call(parameters: {[pname: string]: any}): Promise<any> {
        let basicHTTPModule = (<BasicHTTPModule>this._mod);
        if (!basicHTTPModule.settings().baseUri) {
            throw new Error("HTTP module requires baseUri to be configured")
        }
        var r: Request = {
            url: basicHTTPModule.settings().baseUri + this.method.resource().fullRelativeUrl(),
            method: this.method.method(),
            parameters: []
        }
        this.parameters().forEach(x => {
            let pv = parameters[x.name()];
            if (pv) {
                r.parameters.push({
                    name: x.name(),
                    location: x.location(),
                    value: pv
                })
            }
        })

        return basicHTTPModule.executor.execute(r);
    }
}
export function normalizeType(t: Type): Type {
    if (t.name() == "") {
        if (t.superTypes().length == 1) {
            var hasInterestingFacets = false;
            t.declaredFacets().forEach(x => {
                let metaInformationKind = x.kind();
                if (metaInformationKind == rti.types.MetaInformationKind.DisplayName) {
                    return;
                }
                if (metaInformationKind == rti.types.MetaInformationKind.DiscriminatorValue) {
                    return;
                }
                if (metaInformationKind == rti.types.MetaInformationKind.Description) {
                    return;
                }
                if (metaInformationKind == rti.types.MetaInformationKind.Annotation) {
                    return;
                }
                if (metaInformationKind == rti.types.MetaInformationKind.Example) {
                    return;
                }
                if (metaInformationKind == rti.types.MetaInformationKind.Examples) {
                    return;
                }
                if (metaInformationKind == rti.types.MetaInformationKind.Default) {
                    return;
                }
                if (metaInformationKind == rti.types.MetaInformationKind.Required) {
                    return;
                }
                if (metaInformationKind == rti.types.MetaInformationKind.NotScalar) {
                    return;
                }
                hasInterestingFacets = true;
            })
            if (!hasInterestingFacets) {
                return normalizeType(t.superTypes()[0])
            }
        }
    }
    return t;
}

export function module(a: rti.Api): BasicHTTPModule {
    return new BasicHTTPModule(a);
}
export function callable(mod: Module, m: rti.Method): CallableFunction {
    return new CallableImpl(mod, m);
}