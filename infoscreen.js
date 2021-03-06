const setTimeout = require('timers').setTimeout;
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

let replayEvents = () => {
    setTimeout(() => {
        eventproxy.emit('event', {name: 'temperature', message: global_temperature});  
        eventproxy.emit('event', {name: 'pump', message: pump_status});   
        //getKVGdata();     
    }, 500);
}

routes['/eventstream'] = (req,res) => {
    res.writeHead(200, {'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*'});
    let l =  ({name, message}) => {
        res.write(`event: ${name}\n`);
        message.split('\n').forEach(line => res.write(`data: ${line}\n`));
        res.write('\n');
    };
    eventproxy.on('event',l);
    req.socket.on('close', () => { //Remove eventListener on client disconnection
        eventproxy.removeListener('event',l); 
    });
    replayEvents();
}

let ytcache = {
    v: "",
    active: "",
    pause: "",
    volume: "100"
}

routes['/youtubeupdate'] = (req,res) => {
    let urlparts = url.parse(req.url, true);
    let path = urlparts.pathname;

    if(urlparts.path.indexOf('?') != -1){
        if(urlparts.query.v){
            var vparts = url.parse(urlparts.query.v, true);
            eventproxy.emit('event', {name: 'youtube-v', message: vparts.query.v});
            ytcache.v = vparts.query.v;
        }
        if(urlparts.query.active){
            eventproxy.emit('event', {name: 'youtube-active', message: urlparts.query.active});
            ytcache.active = urlparts.query.active;
        }
        if(urlparts.query.pause){
            eventproxy.emit('event', {name: 'youtube-pause', message: urlparts.query.pause});
            ytcache.pause = urlparts.query.pause;
        }
        if(urlparts.query.volume){
            eventproxy.emit('event', {name: 'youtube-volume', message: urlparts.query.volume});
            ytcache.volume = urlparts.query.volume;
        }
    }
    res.writeHead('200', {'Content-Type': 'text/plain'});
    res.write('OK');
    res.end();
}

routes['/ytcache'] = (req,res) => {
    res.writeHead('200', {'Content-Type': 'application/json'});
    res.write(JSON.stringify(ytcache));
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


let getKVGdata = () => {
    http.get(url.parse('http://kvg-kiel.de/internetservice/services/passageInfo/stopPassages/stop?stop=400&mode=departure'), function(response) {
        var body = '';
        response.on('data', function(d) {
            body += d;
        });
        response.on('end', function() {
            eventproxy.emit('event', {name: 'kvg', message: body});
        });
    });
};

setTimeout(getKVGdata, 30000);
