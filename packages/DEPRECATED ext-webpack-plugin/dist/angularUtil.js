"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._getDefaultVars = _getDefaultVars;
exports._extractFromSource = _extractFromSource;
exports._toProd = _toProd;
exports._toDev = _toDev;
exports._getAllComponents = _getAllComponents;
exports._writeFilesToProdFolder = _writeFilesToProdFolder;

function _getDefaultVars() {
  return {
    touchFile: '/src/themer.ts',
    watchStarted: false,
    buildstep: '1 of 1',
    firstTime: true,
    firstCompile: true,
    browserCount: 0,
    manifest: null,
    extPath: 'ext',
    pluginErrors: [],
    deps: [],
    usedExtComponents: [],
    rebuild: true
  };
}

function _extractFromSource(module, options, compilation, extComponents) {
  const logv = require('./pluginUtil').logv;

  const verbose = options.verbose;
  logv(verbose, 'FUNCTION _extractFromSource');
  var js = module._source._value;
  var statements = [];

  var generate = require("@babel/generator").default;

  var parse = require("babylon").parse;

  var traverse = require("ast-traverse");

  var ast = parse(js, {
    plugins: ['typescript', 'flow', 'doExpressions', 'objectRestSpread', 'classProperties', 'exportDefaultFrom', 'exportExtensions', 'asyncGenerators', 'functionBind', 'functionSent', 'dynamicImport'],
    sourceType: 'module'
  });
  traverse(ast, {
    pre: function (node) {
      if (node.type === 'CallExpression' && node.callee && node.callee.object && node.callee.object.name === 'Ext') {
        statements.push(generate(node).code);
      }

      if (node.type === 'StringLiteral') {
        let code = node.value;

        for (var i = 0; i < code.length; ++i) {
          if (code.charAt(i) == '<') {
            if (code.substr(i, 4) == '<!--') {
              i += 4;
              i += code.substr(i).indexOf('-->') + 3;
            } else if (code.charAt(i + 1) !== '/') {
              var start = code.substring(i);
              var spaceEnd = start.indexOf(' ');
              var newlineEnd = start.indexOf('\n');
              var tagEnd = start.indexOf('>');
              var end = Math.min(spaceEnd, newlineEnd, tagEnd);

              if (end >= 0) {
                var xtype = require('./pluginUtil')._toXtype(start.substring(1, end));

                if (extComponents.includes(xtype)) {
                  var theValue = node.value.toLowerCase();

                  if (theValue.indexOf('doctype html') == -1) {
                    var type = {
                      xtype: xtype
                    };
                    let config = JSON.stringify(type);
                    statements.push(`Ext.create(${config})`);
                  }
                }

                i += end;
              }
            }
          }
        }
      }
    }
  });
  return statements;
}

function changeIt(o) {
  const path = require('path');

  const fsx = require('fs-extra');

  const wherePath = path.resolve(process.cwd(), o.where);
  var js = fsx.readFileSync(wherePath).toString();
  var newJs = js.replace(o.from, o.to);
  fsx.writeFileSync(wherePath, newJs, 'utf-8', () => {
    return;
  });
}

function _toProd(vars, options) {
  const log = require('./pluginUtil').log;

  const logv = require('./pluginUtil').logv;

  logv(options.verbose, 'FUNCTION _toProd');

  const fsx = require('fs-extra');

  const fs = require('fs');

  const mkdirp = require('mkdirp');

  const path = require('path');

  const pathExtAngularProd = path.resolve(process.cwd(), `src/app/ext-angular-prod`);

  if (!fs.existsSync(pathExtAngularProd)) {
    mkdirp.sync(pathExtAngularProd);

    const t = require('./artifacts').extAngularModule('', '', '');

    fsx.writeFileSync(`${pathExtAngularProd}/ext-angular.module.ts`, t, 'utf-8', () => {
      return;
    });
  }

  var o = {};
  o.where = 'src/app/app.module.ts';
  o.from = `import { ExtAngularModule } from '@sencha/ext-angular'`;
  o.to = `import { ExtAngularModule } from './ext-angular-prod/ext-angular.module'`;
  changeIt(o);
  o = {};
  o.where = 'src/main.ts';
  o.from = `bootstrapModule( AppModule );`;
  o.to = `enableProdMode();bootstrapModule(AppModule);`;
  changeIt(o);
}

function _toDev(vars, options) {
  const log = require('./pluginUtil').log;

  const logv = require('./pluginUtil').logv;

  logv(options.verbose, 'FUNCTION _toDev');

  const path = require('path');

  const pathExtAngularProd = path.resolve(process.cwd(), `src/app/ext-angular-prod`);

  require('rimraf').sync(pathExtAngularProd);

  var o = {};
  o.where = 'src/app/app.module.ts';
  o.from = `import { ExtAngularModule } from './ext-angular-prod/ext-angular.module'`;
  o.to = `import { ExtAngularModule } from '@sencha/ext-angular'`;
  changeIt(o);
  o = {};
  o.where = 'src/main.ts';
  o.from = `enableProdMode();bootstrapModule(AppModule);`;
  o.to = `bootstrapModule( AppModule );`;
  changeIt(o);
}

function _getAllComponents(vars, options) {
  const log = require('./pluginUtil').log;

  const logv = require('./pluginUtil').logv;

  logv(options.verbose, 'FUNCTION _getAllComponents');

  const path = require('path');

  const fsx = require('fs-extra'); //    log(vars.app, `Getting all referenced ext-${options.framework} modules`)


  var extComponents = [];
  const packageLibPath = path.resolve(process.cwd(), 'node_modules/@sencha/ext-angular/src/lib');
  var files = fsx.readdirSync(packageLibPath);
  files.forEach(fileName => {
    if (fileName && fileName.substr(0, 4) == 'ext-') {
      var end = fileName.substr(4).indexOf('.component');

      if (end >= 0) {
        extComponents.push(fileName.substring(4, end + 4));
      }
    }
  });
  log(vars.app, `Writing all referenced ext-${options.framework} modules`);
  return extComponents;
}

function _writeFilesToProdFolder(vars, options) {
  const log = require('./pluginUtil').log;

  const logv = require('./pluginUtil').logv;

  logv(options.verbose, 'FUNCTION _writeFilesToProdFolder');

  const path = require('path');

  const fsx = require('fs-extra');

  const packageLibPath = path.resolve(process.cwd(), 'node_modules/@sencha/ext-angular/src/lib');
  const pathToExtAngularProd = path.resolve(process.cwd(), `src/app/ext-angular-prod`);
  const string = 'Ext.create({\"xtype\":\"';
  vars.deps.forEach(code => {
    var index = code.indexOf(string);

    if (index >= 0) {
      code = code.substring(index + string.length);
      var end = code.indexOf('\"');
      vars.usedExtComponents.push(code.substr(0, end));
    }
  });
  vars.usedExtComponents = [...new Set(vars.usedExtComponents)];
  var writeToPathWritten = false;
  var moduleVars = {
    imports: '',
    exports: '',
    declarations: ''
  };
  vars.usedExtComponents.forEach(xtype => {
    var capclassname = xtype.charAt(0).toUpperCase() + xtype.replace(/-/g, "_").slice(1);
    moduleVars.imports = moduleVars.imports + `import { Ext${capclassname}Component } from './ext-${xtype}.component';\n`;
    moduleVars.exports = moduleVars.exports + `    Ext${capclassname}Component,\n`;
    moduleVars.declarations = moduleVars.declarations + `    Ext${capclassname}Component,\n`;
    var classFile = `ext-${xtype}.component.ts`;
    const contents = fsx.readFileSync(`${packageLibPath}/${classFile}`).toString();
    fsx.writeFileSync(`${pathToExtAngularProd}/${classFile}`, contents, 'utf-8', () => {
      return;
    });
    writeToPathWritten = true;
  });

  if (writeToPathWritten) {
    var t = require('./artifacts').extAngularModule(moduleVars.imports, moduleVars.exports, moduleVars.declarations);

    fsx.writeFileSync(`${pathToExtAngularProd}/ext-angular.module.ts`, t, 'utf-8', () => {
      return;
    });
  }

  const baseContent = fsx.readFileSync(`${packageLibPath}/base.ts`).toString();
  fsx.writeFileSync(`${pathToExtAngularProd}/base.ts`, baseContent, 'utf-8', () => {
    return;
  });
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9hbmd1bGFyVXRpbC5qcyJdLCJuYW1lcyI6WyJfZ2V0RGVmYXVsdFZhcnMiLCJ0b3VjaEZpbGUiLCJ3YXRjaFN0YXJ0ZWQiLCJidWlsZHN0ZXAiLCJmaXJzdFRpbWUiLCJmaXJzdENvbXBpbGUiLCJicm93c2VyQ291bnQiLCJtYW5pZmVzdCIsImV4dFBhdGgiLCJwbHVnaW5FcnJvcnMiLCJkZXBzIiwidXNlZEV4dENvbXBvbmVudHMiLCJyZWJ1aWxkIiwiX2V4dHJhY3RGcm9tU291cmNlIiwibW9kdWxlIiwib3B0aW9ucyIsImNvbXBpbGF0aW9uIiwiZXh0Q29tcG9uZW50cyIsImxvZ3YiLCJyZXF1aXJlIiwidmVyYm9zZSIsImpzIiwiX3NvdXJjZSIsIl92YWx1ZSIsInN0YXRlbWVudHMiLCJnZW5lcmF0ZSIsImRlZmF1bHQiLCJwYXJzZSIsInRyYXZlcnNlIiwiYXN0IiwicGx1Z2lucyIsInNvdXJjZVR5cGUiLCJwcmUiLCJub2RlIiwidHlwZSIsImNhbGxlZSIsIm9iamVjdCIsIm5hbWUiLCJwdXNoIiwiY29kZSIsInZhbHVlIiwiaSIsImxlbmd0aCIsImNoYXJBdCIsInN1YnN0ciIsImluZGV4T2YiLCJzdGFydCIsInN1YnN0cmluZyIsInNwYWNlRW5kIiwibmV3bGluZUVuZCIsInRhZ0VuZCIsImVuZCIsIk1hdGgiLCJtaW4iLCJ4dHlwZSIsIl90b1h0eXBlIiwiaW5jbHVkZXMiLCJ0aGVWYWx1ZSIsInRvTG93ZXJDYXNlIiwiY29uZmlnIiwiSlNPTiIsInN0cmluZ2lmeSIsImNoYW5nZUl0IiwibyIsInBhdGgiLCJmc3giLCJ3aGVyZVBhdGgiLCJyZXNvbHZlIiwicHJvY2VzcyIsImN3ZCIsIndoZXJlIiwicmVhZEZpbGVTeW5jIiwidG9TdHJpbmciLCJuZXdKcyIsInJlcGxhY2UiLCJmcm9tIiwidG8iLCJ3cml0ZUZpbGVTeW5jIiwiX3RvUHJvZCIsInZhcnMiLCJsb2ciLCJmcyIsIm1rZGlycCIsInBhdGhFeHRBbmd1bGFyUHJvZCIsImV4aXN0c1N5bmMiLCJzeW5jIiwidCIsImV4dEFuZ3VsYXJNb2R1bGUiLCJfdG9EZXYiLCJfZ2V0QWxsQ29tcG9uZW50cyIsInBhY2thZ2VMaWJQYXRoIiwiZmlsZXMiLCJyZWFkZGlyU3luYyIsImZvckVhY2giLCJmaWxlTmFtZSIsImFwcCIsImZyYW1ld29yayIsIl93cml0ZUZpbGVzVG9Qcm9kRm9sZGVyIiwicGF0aFRvRXh0QW5ndWxhclByb2QiLCJzdHJpbmciLCJpbmRleCIsIlNldCIsIndyaXRlVG9QYXRoV3JpdHRlbiIsIm1vZHVsZVZhcnMiLCJpbXBvcnRzIiwiZXhwb3J0cyIsImRlY2xhcmF0aW9ucyIsImNhcGNsYXNzbmFtZSIsInRvVXBwZXJDYXNlIiwic2xpY2UiLCJjbGFzc0ZpbGUiLCJjb250ZW50cyIsImJhc2VDb250ZW50Il0sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7O0FBRU8sU0FBU0EsZUFBVCxHQUEyQjtBQUNoQyxTQUFPO0FBQ0xDLElBQUFBLFNBQVMsRUFBRSxnQkFETjtBQUVMQyxJQUFBQSxZQUFZLEVBQUcsS0FGVjtBQUdMQyxJQUFBQSxTQUFTLEVBQUUsUUFITjtBQUlMQyxJQUFBQSxTQUFTLEVBQUcsSUFKUDtBQUtMQyxJQUFBQSxZQUFZLEVBQUUsSUFMVDtBQU1MQyxJQUFBQSxZQUFZLEVBQUcsQ0FOVjtBQU9MQyxJQUFBQSxRQUFRLEVBQUUsSUFQTDtBQVFMQyxJQUFBQSxPQUFPLEVBQUUsS0FSSjtBQVNMQyxJQUFBQSxZQUFZLEVBQUUsRUFUVDtBQVVMQyxJQUFBQSxJQUFJLEVBQUUsRUFWRDtBQVdMQyxJQUFBQSxpQkFBaUIsRUFBRSxFQVhkO0FBWUxDLElBQUFBLE9BQU8sRUFBRTtBQVpKLEdBQVA7QUFjRDs7QUFFTSxTQUFTQyxrQkFBVCxDQUE0QkMsTUFBNUIsRUFBb0NDLE9BQXBDLEVBQTZDQyxXQUE3QyxFQUEwREMsYUFBMUQsRUFBeUU7QUFDOUUsUUFBTUMsSUFBSSxHQUFHQyxPQUFPLENBQUMsY0FBRCxDQUFQLENBQXdCRCxJQUFyQzs7QUFD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QVUsQ0FBQ0csWUFBWCxHQUEyQixVQUFTQyxZQUFhLGNBQTNFO0FBQ0EsUUFBSUcsU0FBUyxHQUFJLE9BQU14RCxLQUFNLGVBQTdCO0FBQ0EsVUFBTXlELFFBQVEsR0FBRzlDLEdBQUcsQ0FBQ00sWUFBSixDQUFrQixHQUFFbUIsY0FBZSxJQUFHb0IsU0FBVSxFQUFoRCxFQUFtRHRDLFFBQW5ELEVBQWpCO0FBQ0FQLElBQUFBLEdBQUcsQ0FBQ1ksYUFBSixDQUFtQixHQUFFcUIsb0JBQXFCLElBQUdZLFNBQVUsRUFBdkQsRUFBMERDLFFBQTFELEVBQW9FLE9BQXBFLEVBQTZFLE1BQUk7QUFBQztBQUFPLEtBQXpGO0FBQ0FULElBQUFBLGtCQUFrQixHQUFHLElBQXJCO0FBQ0QsR0FURDs7QUFVQSxNQUFJQSxrQkFBSixFQUF3QjtBQUN0QixRQUFJaEIsQ0FBQyxHQUFHbkUsT0FBTyxDQUFDLGFBQUQsQ0FBUCxDQUF1Qm9FLGdCQUF2QixDQUNOZ0IsVUFBVSxDQUFDQyxPQURMLEVBQ2NELFVBQVUsQ0FBQ0UsT0FEekIsRUFDa0NGLFVBQVUsQ0FBQ0csWUFEN0MsQ0FBUjs7QUFHQXpDLElBQUFBLEdBQUcsQ0FBQ1ksYUFBSixDQUFtQixHQUFFcUIsb0JBQXFCLHdCQUExQyxFQUFtRVosQ0FBbkUsRUFBc0UsT0FBdEUsRUFBK0UsTUFBSTtBQUFDO0FBQU8sS0FBM0Y7QUFDRDs7QUFFRCxRQUFNMEIsV0FBVyxHQUFHL0MsR0FBRyxDQUFDTSxZQUFKLENBQWtCLEdBQUVtQixjQUFlLFVBQW5DLEVBQThDbEIsUUFBOUMsRUFBcEI7QUFDQVAsRUFBQUEsR0FBRyxDQUFDWSxhQUFKLENBQW1CLEdBQUVxQixvQkFBcUIsVUFBMUMsRUFBcURjLFdBQXJELEVBQWtFLE9BQWxFLEVBQTJFLE1BQUk7QUFBQztBQUFPLEdBQXZGO0FBQ0QiLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIlxuXG5leHBvcnQgZnVuY3Rpb24gX2dldERlZmF1bHRWYXJzKCkge1xuICByZXR1cm4ge1xuICAgIHRvdWNoRmlsZTogJy9zcmMvdGhlbWVyLnRzJyxcbiAgICB3YXRjaFN0YXJ0ZWQgOiBmYWxzZSxcbiAgICBidWlsZHN0ZXA6ICcxIG9mIDEnLFxuICAgIGZpcnN0VGltZSA6IHRydWUsXG4gICAgZmlyc3RDb21waWxlOiB0cnVlLFxuICAgIGJyb3dzZXJDb3VudCA6IDAsXG4gICAgbWFuaWZlc3Q6IG51bGwsXG4gICAgZXh0UGF0aDogJ2V4dCcsXG4gICAgcGx1Z2luRXJyb3JzOiBbXSxcbiAgICBkZXBzOiBbXSxcbiAgICB1c2VkRXh0Q29tcG9uZW50czogW10sXG4gICAgcmVidWlsZDogdHJ1ZVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfZXh0cmFjdEZyb21Tb3VyY2UobW9kdWxlLCBvcHRpb25zLCBjb21waWxhdGlvbiwgZXh0Q29tcG9uZW50cykge1xuICBjb25zdCBsb2d2ID0gcmVxdWlyZSgnLi9wbHVnaW5VdGlsJykubG9ndlxuICBjb25zdCB2ZXJib3NlID0gb3B0aW9ucy52ZXJib3NlXG4gIGxvZ3YodmVyYm9zZSwnRlVOQ1RJT04gX2V4dHJhY3RGcm9tU291cmNlJylcbiAgdmFyIGpzID0gbW9kdWxlLl9zb3VyY2UuX3ZhbHVlXG5cbiAgdmFyIHN0YXRlbWVudHMgPSBbXVxuXG4gIHZhciBnZW5lcmF0ZSA9IHJlcXVpcmUoXCJAYmFiZWwvZ2VuZXJhdG9yXCIpLmRlZmF1bHRcbiAgdmFyIHBhcnNlID0gcmVxdWlyZShcImJhYnlsb25cIikucGFyc2VcbiAgdmFyIHRyYXZlcnNlID0gcmVxdWlyZShcImFzdC10cmF2ZXJzZVwiKVxuXG4gIHZhciBhc3QgPSBwYXJzZShqcywge1xuICAgIHBsdWdpbnM6IFtcbiAgICAgICd0eXBlc2NyaXB0JyxcbiAgICAgICdmbG93JyxcbiAgICAgICdkb0V4cHJlc3Npb25zJyxcbiAgICAgICdvYmplY3RSZXN0U3ByZWFkJyxcbiAgICAgICdjbGFzc1Byb3BlcnRpZXMnLFxuICAgICAgJ2V4cG9ydERlZmF1bHRGcm9tJyxcbiAgICAgICdleHBvcnRFeHRlbnNpb25zJyxcbiAgICAgICdhc3luY0dlbmVyYXRvcnMnLFxuICAgICAgJ2Z1bmN0aW9uQmluZCcsXG4gICAgICAnZnVuY3Rpb25TZW50JyxcbiAgICAgICdkeW5hbWljSW1wb3J0J1xuICAgIF0sXG4gICAgc291cmNlVHlwZTogJ21vZHVsZSdcbiAgfSlcblxuICB0cmF2ZXJzZShhc3QsIHtcbiAgICBwcmU6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICBpZiAobm9kZS50eXBlID09PSAnQ2FsbEV4cHJlc3Npb24nICYmIG5vZGUuY2FsbGVlICYmIG5vZGUuY2FsbGVlLm9iamVjdCAmJiBub2RlLmNhbGxlZS5vYmplY3QubmFtZSA9PT0gJ0V4dCcpIHtcbiAgICAgICAgc3RhdGVtZW50cy5wdXNoKGdlbmVyYXRlKG5vZGUpLmNvZGUpXG4gICAgICB9XG4gICAgICBpZihub2RlLnR5cGUgPT09ICdTdHJpbmdMaXRlcmFsJykge1xuICAgICAgICBsZXQgY29kZSA9IG5vZGUudmFsdWVcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb2RlLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgaWYgKGNvZGUuY2hhckF0KGkpID09ICc8Jykge1xuICAgICAgICAgICAgaWYgKGNvZGUuc3Vic3RyKGksIDQpID09ICc8IS0tJykge1xuICAgICAgICAgICAgICBpICs9IDRcbiAgICAgICAgICAgICAgaSArPSBjb2RlLnN1YnN0cihpKS5pbmRleE9mKCctLT4nKSArIDNcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY29kZS5jaGFyQXQoaSsxKSAhPT0gJy8nKSB7XG4gICAgICAgICAgICAgIHZhciBzdGFydCA9IGNvZGUuc3Vic3RyaW5nKGkpXG4gICAgICAgICAgICAgIHZhciBzcGFjZUVuZCA9IHN0YXJ0LmluZGV4T2YoJyAnKVxuICAgICAgICAgICAgICB2YXIgbmV3bGluZUVuZCA9IHN0YXJ0LmluZGV4T2YoJ1xcbicpXG4gICAgICAgICAgICAgIHZhciB0YWdFbmQgPSBzdGFydC5pbmRleE9mKCc+JylcbiAgICAgICAgICAgICAgdmFyIGVuZCA9IE1hdGgubWluKHNwYWNlRW5kLCBuZXdsaW5lRW5kLCB0YWdFbmQpXG4gICAgICAgICAgICAgIGlmIChlbmQgPj0gMCkge1xuICAgICAgICAgICAgICAgIHZhciB4dHlwZSA9IHJlcXVpcmUoJy4vcGx1Z2luVXRpbCcpLl90b1h0eXBlKHN0YXJ0LnN1YnN0cmluZygxLCBlbmQpKVxuICAgICAgICAgICAgICAgIGlmKGV4dENvbXBvbmVudHMuaW5jbHVkZXMoeHR5cGUpKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgdGhlVmFsdWUgPSBub2RlLnZhbHVlLnRvTG93ZXJDYXNlKClcbiAgICAgICAgICAgICAgICAgIGlmICh0aGVWYWx1ZS5pbmRleE9mKCdkb2N0eXBlIGh0bWwnKSA9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdHlwZSA9IHt4dHlwZTogeHR5cGV9XG4gICAgICAgICAgICAgICAgICAgIGxldCBjb25maWcgPSBKU09OLnN0cmluZ2lmeSh0eXBlKVxuICAgICAgICAgICAgICAgICAgICBzdGF0ZW1lbnRzLnB1c2goYEV4dC5jcmVhdGUoJHtjb25maWd9KWApXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGkgKz0gZW5kXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHN0YXRlbWVudHNcbn1cblxuZnVuY3Rpb24gY2hhbmdlSXQobykge1xuICBjb25zdCBwYXRoID0gcmVxdWlyZSgncGF0aCcpXG4gIGNvbnN0IGZzeCA9IHJlcXVpcmUoJ2ZzLWV4dHJhJylcbiAgY29uc3Qgd2hlcmVQYXRoID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIG8ud2hlcmUpXG4gIHZhciBqcyA9IGZzeC5yZWFkRmlsZVN5bmMod2hlcmVQYXRoKS50b1N0cmluZygpXG4gIHZhciBuZXdKcyA9IGpzLnJlcGxhY2Uoby5mcm9tLG8udG8pO1xuICBmc3gud3JpdGVGaWxlU3luYyh3aGVyZVBhdGgsIG5ld0pzLCAndXRmLTgnLCAoKT0+e3JldHVybn0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfdG9Qcm9kKHZhcnMsIG9wdGlvbnMpIHtcbiAgY29uc3QgbG9nID0gcmVxdWlyZSgnLi9wbHVnaW5VdGlsJykubG9nXG4gIGNvbnN0IGxvZ3YgPSByZXF1aXJlKCcuL3BsdWdpblV0aWwnKS5sb2d2XG4gIGxvZ3Yob3B0aW9ucy52ZXJib3NlLCdGVU5DVElPTiBfdG9Qcm9kJylcbiAgY29uc3QgZnN4ID0gcmVxdWlyZSgnZnMtZXh0cmEnKVxuICBjb25zdCBmcyA9IHJlcXVpcmUoJ2ZzJylcbiAgY29uc3QgbWtkaXJwID0gcmVxdWlyZSgnbWtkaXJwJylcbiAgY29uc3QgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKVxuXG4gIGNvbnN0IHBhdGhFeHRBbmd1bGFyUHJvZCA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBgc3JjL2FwcC9leHQtYW5ndWxhci1wcm9kYCk7XG4gIGlmICghZnMuZXhpc3RzU3luYyhwYXRoRXh0QW5ndWxhclByb2QpKSB7XG4gICAgbWtkaXJwLnN5bmMocGF0aEV4dEFuZ3VsYXJQcm9kKVxuICAgIGNvbnN0IHQgPSByZXF1aXJlKCcuL2FydGlmYWN0cycpLmV4dEFuZ3VsYXJNb2R1bGUoJycsICcnLCAnJylcbiAgICBmc3gud3JpdGVGaWxlU3luYyhgJHtwYXRoRXh0QW5ndWxhclByb2R9L2V4dC1hbmd1bGFyLm1vZHVsZS50c2AsIHQsICd1dGYtOCcsICgpID0+IHtcbiAgICAgIHJldHVyblxuICAgIH0pXG4gIH1cblxuICB2YXIgbyA9IHt9XG4gIG8ud2hlcmUgPSAnc3JjL2FwcC9hcHAubW9kdWxlLnRzJ1xuICBvLmZyb20gPSBgaW1wb3J0IHsgRXh0QW5ndWxhck1vZHVsZSB9IGZyb20gJ0BzZW5jaGEvZXh0LWFuZ3VsYXInYFxuICBvLnRvID0gYGltcG9ydCB7IEV4dEFuZ3VsYXJNb2R1bGUgfSBmcm9tICcuL2V4dC1hbmd1bGFyLXByb2QvZXh0LWFuZ3VsYXIubW9kdWxlJ2BcbiAgY2hhbmdlSXQobylcblxuICBvID0ge31cbiAgby53aGVyZSA9ICdzcmMvbWFpbi50cydcbiAgby5mcm9tID0gYGJvb3RzdHJhcE1vZHVsZSggQXBwTW9kdWxlICk7YFxuICBvLnRvID0gYGVuYWJsZVByb2RNb2RlKCk7Ym9vdHN0cmFwTW9kdWxlKEFwcE1vZHVsZSk7YFxuICBjaGFuZ2VJdChvKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gX3RvRGV2KHZhcnMsIG9wdGlvbnMpIHtcbiAgY29uc3QgbG9nID0gcmVxdWlyZSgnLi9wbHVnaW5VdGlsJykubG9nXG4gIGNvbnN0IGxvZ3YgPSByZXF1aXJlKCcuL3BsdWdpblV0aWwnKS5sb2d2XG4gIGxvZ3Yob3B0aW9ucy52ZXJib3NlLCdGVU5DVElPTiBfdG9EZXYnKVxuICBjb25zdCBwYXRoID0gcmVxdWlyZSgncGF0aCcpXG4gIGNvbnN0IHBhdGhFeHRBbmd1bGFyUHJvZCA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBgc3JjL2FwcC9leHQtYW5ndWxhci1wcm9kYCk7XG4gIHJlcXVpcmUoJ3JpbXJhZicpLnN5bmMocGF0aEV4dEFuZ3VsYXJQcm9kKTtcblxuICB2YXIgbyA9IHt9XG4gIG8ud2hlcmUgPSAnc3JjL2FwcC9hcHAubW9kdWxlLnRzJ1xuICBvLmZyb20gPSBgaW1wb3J0IHsgRXh0QW5ndWxhck1vZHVsZSB9IGZyb20gJy4vZXh0LWFuZ3VsYXItcHJvZC9leHQtYW5ndWxhci5tb2R1bGUnYFxuICBvLnRvID0gYGltcG9ydCB7IEV4dEFuZ3VsYXJNb2R1bGUgfSBmcm9tICdAc2VuY2hhL2V4dC1hbmd1bGFyJ2BcbiAgY2hhbmdlSXQobylcblxuICBvID0ge31cbiAgby53aGVyZSA9ICdzcmMvbWFpbi50cydcbiAgby5mcm9tID0gYGVuYWJsZVByb2RNb2RlKCk7Ym9vdHN0cmFwTW9kdWxlKEFwcE1vZHVsZSk7YFxuICBvLnRvID0gYGJvb3RzdHJhcE1vZHVsZSggQXBwTW9kdWxlICk7YFxuICBjaGFuZ2VJdChvKVxufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBfZ2V0QWxsQ29tcG9uZW50cyh2YXJzLCBvcHRpb25zKSB7XG4gIGNvbnN0IGxvZyA9IHJlcXVpcmUoJy4vcGx1Z2luVXRpbCcpLmxvZ1xuICBjb25zdCBsb2d2ID0gcmVxdWlyZSgnLi9wbHVnaW5VdGlsJykubG9ndlxuICBsb2d2KG9wdGlvbnMudmVyYm9zZSwnRlVOQ1RJT04gX2dldEFsbENvbXBvbmVudHMnKVxuXG4gIGNvbnN0IHBhdGggPSByZXF1aXJlKCdwYXRoJylcbiAgY29uc3QgZnN4ID0gcmVxdWlyZSgnZnMtZXh0cmEnKVxuXG4vLyAgICBsb2codmFycy5hcHAsIGBHZXR0aW5nIGFsbCByZWZlcmVuY2VkIGV4dC0ke29wdGlvbnMuZnJhbWV3b3JrfSBtb2R1bGVzYClcbiAgdmFyIGV4dENvbXBvbmVudHMgPSBbXVxuICBjb25zdCBwYWNrYWdlTGliUGF0aCA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCAnbm9kZV9tb2R1bGVzL0BzZW5jaGEvZXh0LWFuZ3VsYXIvc3JjL2xpYicpXG4gIHZhciBmaWxlcyA9IGZzeC5yZWFkZGlyU3luYyhwYWNrYWdlTGliUGF0aClcbiAgZmlsZXMuZm9yRWFjaCgoZmlsZU5hbWUpID0+IHtcbiAgICBpZiAoZmlsZU5hbWUgJiYgZmlsZU5hbWUuc3Vic3RyKDAsIDQpID09ICdleHQtJykge1xuICAgICAgdmFyIGVuZCA9IGZpbGVOYW1lLnN1YnN0cig0KS5pbmRleE9mKCcuY29tcG9uZW50JylcbiAgICAgIGlmIChlbmQgPj0gMCkge1xuICAgICAgICBleHRDb21wb25lbnRzLnB1c2goZmlsZU5hbWUuc3Vic3RyaW5nKDQsIGVuZCArIDQpKVxuICAgICAgfVxuICAgIH1cbiAgfSlcbiAgbG9nKHZhcnMuYXBwLCBgV3JpdGluZyBhbGwgcmVmZXJlbmNlZCBleHQtJHtvcHRpb25zLmZyYW1ld29ya30gbW9kdWxlc2ApXG4gIHJldHVybiBleHRDb21wb25lbnRzXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfd3JpdGVGaWxlc1RvUHJvZEZvbGRlcih2YXJzLCBvcHRpb25zKSB7XG4gIGNvbnN0IGxvZyA9IHJlcXVpcmUoJy4vcGx1Z2luVXRpbCcpLmxvZ1xuICBjb25zdCBsb2d2ID0gcmVxdWlyZSgnLi9wbHVnaW5VdGlsJykubG9ndlxuICBsb2d2KG9wdGlvbnMudmVyYm9zZSwnRlVOQ1RJT04gX3dyaXRlRmlsZXNUb1Byb2RGb2xkZXInKVxuXG4gIGNvbnN0IHBhdGggPSByZXF1aXJlKCdwYXRoJylcbiAgY29uc3QgZnN4ID0gcmVxdWlyZSgnZnMtZXh0cmEnKVxuXG4gIGNvbnN0IHBhY2thZ2VMaWJQYXRoID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksICdub2RlX21vZHVsZXMvQHNlbmNoYS9leHQtYW5ndWxhci9zcmMvbGliJylcbiAgY29uc3QgcGF0aFRvRXh0QW5ndWxhclByb2QgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgYHNyYy9hcHAvZXh0LWFuZ3VsYXItcHJvZGApXG4gIGNvbnN0IHN0cmluZyA9ICdFeHQuY3JlYXRlKHtcXFwieHR5cGVcXFwiOlxcXCInXG5cbiAgdmFycy5kZXBzLmZvckVhY2goY29kZSA9PiB7XG4gICAgdmFyIGluZGV4ID0gY29kZS5pbmRleE9mKHN0cmluZylcbiAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgY29kZSA9IGNvZGUuc3Vic3RyaW5nKGluZGV4ICsgc3RyaW5nLmxlbmd0aClcbiAgICAgIHZhciBlbmQgPSBjb2RlLmluZGV4T2YoJ1xcXCInKVxuICAgICAgdmFycy51c2VkRXh0Q29tcG9uZW50cy5wdXNoKGNvZGUuc3Vic3RyKDAsIGVuZCkpXG4gICAgfVxuICB9KVxuICB2YXJzLnVzZWRFeHRDb21wb25lbnRzID0gWy4uLm5ldyBTZXQodmFycy51c2VkRXh0Q29tcG9uZW50cyldXG5cbiAgdmFyIHdyaXRlVG9QYXRoV3JpdHRlbiA9IGZhbHNlXG4gIHZhciBtb2R1bGVWYXJzID0ge1xuICAgIGltcG9ydHM6ICcnLFxuICAgIGV4cG9ydHM6ICcnLFxuICAgIGRlY2xhcmF0aW9uczogJydcbiAgfVxuICB2YXJzLnVzZWRFeHRDb21wb25lbnRzLmZvckVhY2goeHR5cGUgPT4ge1xuICAgIHZhciBjYXBjbGFzc25hbWUgPSB4dHlwZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHh0eXBlLnJlcGxhY2UoLy0vZywgXCJfXCIpLnNsaWNlKDEpXG4gICAgbW9kdWxlVmFycy5pbXBvcnRzID0gbW9kdWxlVmFycy5pbXBvcnRzICsgYGltcG9ydCB7IEV4dCR7Y2FwY2xhc3NuYW1lfUNvbXBvbmVudCB9IGZyb20gJy4vZXh0LSR7eHR5cGV9LmNvbXBvbmVudCc7XFxuYFxuICAgIG1vZHVsZVZhcnMuZXhwb3J0cyA9IG1vZHVsZVZhcnMuZXhwb3J0cyArIGAgICAgRXh0JHtjYXBjbGFzc25hbWV9Q29tcG9uZW50LFxcbmBcbiAgICBtb2R1bGVWYXJzLmRlY2xhcmF0aW9ucyA9IG1vZHVsZVZhcnMuZGVjbGFyYXRpb25zICsgYCAgICBFeHQke2NhcGNsYXNzbmFtZX1Db21wb25lbnQsXFxuYFxuICAgIHZhciBjbGFzc0ZpbGUgPSBgZXh0LSR7eHR5cGV9LmNvbXBvbmVudC50c2BcbiAgICBjb25zdCBjb250ZW50cyA9IGZzeC5yZWFkRmlsZVN5bmMoYCR7cGFja2FnZUxpYlBhdGh9LyR7Y2xhc3NGaWxlfWApLnRvU3RyaW5nKClcbiAgICBmc3gud3JpdGVGaWxlU3luYyhgJHtwYXRoVG9FeHRBbmd1bGFyUHJvZH0vJHtjbGFzc0ZpbGV9YCwgY29udGVudHMsICd1dGYtOCcsICgpPT57cmV0dXJufSlcbiAgICB3cml0ZVRvUGF0aFdyaXR0ZW4gPSB0cnVlXG4gIH0pXG4gIGlmICh3cml0ZVRvUGF0aFdyaXR0ZW4pIHtcbiAgICB2YXIgdCA9IHJlcXVpcmUoJy4vYXJ0aWZhY3RzJykuZXh0QW5ndWxhck1vZHVsZShcbiAgICAgIG1vZHVsZVZhcnMuaW1wb3J0cywgbW9kdWxlVmFycy5leHBvcnRzLCBtb2R1bGVWYXJzLmRlY2xhcmF0aW9uc1xuICAgIClcbiAgICBmc3gud3JpdGVGaWxlU3luYyhgJHtwYXRoVG9FeHRBbmd1bGFyUHJvZH0vZXh0LWFuZ3VsYXIubW9kdWxlLnRzYCwgdCwgJ3V0Zi04JywgKCk9PntyZXR1cm59KVxuICB9XG5cbiAgY29uc3QgYmFzZUNvbnRlbnQgPSBmc3gucmVhZEZpbGVTeW5jKGAke3BhY2thZ2VMaWJQYXRofS9iYXNlLnRzYCkudG9TdHJpbmcoKVxuICBmc3gud3JpdGVGaWxlU3luYyhgJHtwYXRoVG9FeHRBbmd1bGFyUHJvZH0vYmFzZS50c2AsIGJhc2VDb250ZW50LCAndXRmLTgnLCAoKT0+e3JldHVybn0pXG59Il19