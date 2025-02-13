/*global System*/
import LivelyServer from "../server.js";
import fs from "fs";
import { basename, join } from "path";
import { resource } from "lively.resources";

export default class LibLookupPlugin {

  constructor() {
    this._fsRootDir = null;
  }

  setOptions({route} = {}) {}

  get pluginId() { return "lib-lookup"; }

  toString() { return `<${this.pluginId}>`; }

  get before() { return ["jsdav"]; }

  setup(livelyServer) {
    this._fsRootDir = livelyServer.options.jsdav.rootDirectory;
  }

  async close() {}

  get libPath() { return "/lively.next-node_modules/"; }

  get fsRootDir() {
    let {_fsRootDir} = this;
    if (!_fsRootDir) throw new Error("fsRootDir not set, was setup(livelyServer) called?")
    return _fsRootDir;
  }

  get packageRegistry() { return System.get("@lively-env").packageRegistry; }

  sendPackageRegistry(req, res) {
    let r = this.packageRegistry;
    res.writeHead(200,  {"Content-Type": "application/json"});
    res.end(JSON.stringify(r.toJSON()));
  }

  async handleRequest(req, res, next) {
    let {libPath, fsRootDir} = this, {url: path} = req;

    if (path === "/package-registry.json") return this.sendPackageRegistry(req, res);

    if (!path.startsWith(libPath) || path === libPath) return next();

    path = decodeURIComponent(path);
    let [_, _2, fullPackageName, ...rest] = path.split("/"),
        [packageName, version] = fullPackageName.split("@"),
        fullLibPath = join(fsRootDir, libPath);

    if (version) {
      if (fs.existsSync(join(fullLibPath, packageName, version))) return next();
    } else {
      if (fs.existsSync(join(fullLibPath, packageName, ...rest))) return next();
    }
    

    let registry = this.packageRegistry;
    if (!registry) return next();

    let pkg = registry.lookup(packageName, version);
    if (!pkg) return next();

    let pkgURL = resource(pkg.url).path(),
        index = pkgURL.indexOf(fullLibPath)

    if (index !== 0) return next();
    
    let newPath = join(libPath, pkgURL.slice(fullLibPath.length), ...rest);
    req.url = newPath;

    res.writeHead(301,  {location: newPath});
    res.end();
  }

}