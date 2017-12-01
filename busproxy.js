const http = require('http');
const url = require('url');
const fs = require('fs');
const EventEmitter = require('events');
const exec = require('child_process').exec;

var eventproxy = new class extends EventEmitter{}();

let routes = {};

const server = http.createServer((req, res) => {
    try{
        let urlparts = url.parse(req.url, true);
        let path = urlparts.pathname.trim();
        console.log("request: " + path);
        if(!routes[path]){
            res.writeHead(400, { 'Content-Type': 'text/plain'});
            res.write("There is no function registered under this path");
            res.end();
        }else{
            routes[path](req,res);
        }

    }catch(e){
        res.writeHead(500, { 'Content-Type': 'text/plain'});
        res.write(e.message);
        res.end();
    }
});

server.listen(8123);

let sendfile = filename => (req,res) => {
    var page = fs.readFileSync(filename,'utf-8');
    res.writeHead(200, {'Content-Type': 'text/html', "Access-Control-Allow-Origin": "*", 'Content-Length': Buffer.byteLength(page + "")});
    res.write(page);
    res.end();
}


routes['/'] = sendfile('infoscreen.html');

routes['/youtube'] = sendfile('youtubectrl.html');

routes['/eventstream'] = (req,res) => {
    res.writeHead(200, {'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*'});
    eventproxy.eventNames().forEach(eventname => {
        console.log(eventname);
        eventproxy.on('event', ({name, message}) => {
            res.write(`event: ${name}\n`);
            res.write(`data: ${message}\n\n`);
        });
    });

}

routes['/youtubeupdate'] = (req,res) => {
    let urlparts = url.parse(req.url, true);
    let path = urlparts.pathname;

    if(urlparts.path.indexOf('?') != -1){
        if(urlparts.query.v){
            var vparts = url.parse(urlparts.query.v, true);
            eventproxy.emit('event', {name: 'youtube-v', message: vparts.query.v});
        }
        if(urlparts.query.active){
            eventproxy.emit('event', {name: 'youtube-active', message: urlparts.query.active});
        }
        if(urlparts.query.pause){
            eventproxy.emit('event', {name: 'youtube-pause', message: urlparts.query.pause});
        }
    }
    res.writeHead('200', {'Content-Type': 'text/plain'});
    res.write('OK');
    res.end();
}


let global_temperature = 0;
let pump_status = false;

setTimeout(()=>{
    //Read temperature
    exec('sensors',(err, stdout, stderr) => {
        let temperature = /temp1:\s+[+-](\d+.\d?)°C/.exec(stdout)[1];
        if(temperature != global_temperature){
            global_temperature = temperature;
            eventproxy.emit('event', {name: 'temperature', message: temperature});
        }
    });
    //Read pump
    let status = fs.readFileSync("../pumpstatus",'utf-8');
    if(pump_status != status){
        pump_status = status;
        eventproxy.emit('event', {name: 'pump', message: status});
    }
}, 500);


setTimeout(()=>{
    http.get(url.parse('http://kvg-kiel.de/internetservice/services/passageInfo/stopPassages/stop?stop=400&mode=departure'), function(response) {
        var body = '';
        response.on('data', function(d) {
            body += d;
        });
        response.on('end', function() {
            eventproxy.emit('event', {name: 'kvg', message: body});
        });
    });
}, 60000);
