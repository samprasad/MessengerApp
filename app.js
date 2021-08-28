const express             = require('express');
const session             = require('express-session');   
const bodyParser          = require('body-parser');  
const mongodb             = require('mongodb');    
const MongoClient         = require('mongodb').MongoClient;   
const app                 = express();
const http                = require('http');
const server              = http.createServer(app);
const { Server }          = require("socket.io");
const io                  = new Server(server);   
const urlencodedParser    = bodyParser.urlencoded({ extended: false })
const port                = 8000;  
const dbName              = 'messenging_db';  
const mongoUrl            = "mongodb://localhost:27017/"; 
const loginCollection     = 'app_login';  
const activityCollection  = 'activity_log';  
const messageCollection   = 'messages_user';   
/* Mongo client connect */ 
var db;
MongoClient.connect(mongoUrl,function(error,database){
    db = database.db(dbName);
    db.createCollection(loginCollection,function(error,databaseResponse){
        console.log(loginCollection+' collection created');
    }); 
    db.createCollection(activityCollection,function(error,databaseResponse){
        console.log(activityCollection+' collection created');   
    });
    db.createCollection(messageCollection,function(error,databaseResponse){
        console.log(messageCollection+' collection created');   
    });         
}); 
/* End Mongo client connect */   
app.use(express.static('public'));
app.use(session({                     // use session 
    secret: 'keyboard cat'
}));

app.engine('pug', require('pug').__express); 
app.set("view engine","pug");     //set template engine to pug
app.set("views","./views"); 

/*  Set Login page for index route */
app.get('/',function(request,response){  
    if(request.session.login==1) {
        response.redirect('/home'); 
    } else {
        response.render('login');            
    }
});
/*  end index route */

/*  Set  page for activity route */
app.get('/activity',function(request,response){  
    response.sendFile(__dirname + '/public/activity.html');             
});
/*  end index route */   

/*  Home route */  
app.get('/home',function(request,response){
    if(request.session.login==1) {  
        var username      = request.session.username;        //username from session     
        var loggedin_date = new Date();             
        io.on('connection', (socket) => {
            socket.on('logged', (msg) => {    
                io.emit('logged',username+' logged in at: '+loggedin_date);    
            });                          
        });         
        db.collection(loginCollection).find({}).toArray(function(error,loginResponse){ 
            var users = loginResponse;  
            response.render('home',{users:users,username:username});   
        });        
    } else { 
        response.redirect('/');  
    }
});
/* End Home route */ 

/*  Messages route */
app.get('/messages',function(request,response){  
    if(request.session.login==1) {  
        var username = request.session.username;        //username from session   
        db.collection(loginCollection).find({}).toArray(function(error,loginResponse){ 
            var users = loginResponse;  
            db.collection(messageCollection).find({}).sort({'_id': -1}).toArray(function(error,messageResponse){ 
                var messages = messageResponse;  // 
                response.render('messages',{messages:messages,users:users,username:username});   
            });   
        });         
    } else { 
        response.redirect('/');  
    }
});      
/* End messages route */

/* Post login check from mongo */
app.post('/login',urlencodedParser,function(request,response){      
    var username = request.body.username;
    var password = request.body.password; 
    var loginQuery = {
        username : username,  
        password : password     
    }
    db.collection(loginCollection).find(loginQuery).toArray(function(error,loginRow){
        if(loginRow.length > 0) {
            request.session.login    = 1;
            request.session.username = username;      
            response.redirect('/home');      
        }
        else {
            response.render('login',{msg:'Invalid user or password'});  
        }          
    });             
}); 
/* End post login */

/* login route */
app.get('/login',function(request,response){ 
    if(request.session.login==1) {
        response.redirect('/home'); 
    } else {
        response.render('login');            
    }
});
/* End login route */ 

/* delete route */
app.get('/messages/delete/:id',function(request,response) {
    const id = request.params.id;  
    db.collection(messageCollection, function(error, collection) { 
        collection.deleteOne({_id: new mongodb.ObjectID(id)},function(err,result){
            response.redirect('/messages');   
        });     
    });              
});    
/* End delete route */ 

/* Register post route to register and insert posted data into mongo */
app.post('/register',urlencodedParser,function(request,response){ 
    var username   = request.body.username;
    var email      = request.body.email;
    var password   = request.body.password;
    var confirm    = request.body.cpassword; 
    var postValues = [{"username":username,"email":email,"password":password,"confirm":confirm}]; 
    var errors     = false; 
    var errorMsg;
    //-------------basic validations------------
    if(password!=confirm) { 
        errors   = true;
        errorMsg = 'Password does not match';  
    } else if(username.length < 3) {
        errors   = true;
        errorMsg = 'Username has to be min 3 characters';  
    } else if(password.length < 3 || confirm.length < 3) {
        errors   = true;
        errorMsg = 'Password too short';          
    }  
    //----------end validations---------------
    if(errors == false) {
        var registerQuery = {
            username : username,
            email    : email,
            password : password
        } 
        db.collection(loginCollection).save(registerQuery,function(error,dbres){
            if(error){
                response.render('register',{msg:error}); 
            } else {
                request.session.login    = 1;
                request.session.username = username;      
                response.redirect('/home'); 
            }
        }); 
    } else {    
        response.render('register',{msg:errorMsg,postValues:postValues[0]});
    }   
});     
/* end post register */

/* Message post route to register and insert posted data into mongo */
app.post('/send',urlencodedParser,function(request,response){   
    var username      = request.session.username;
    var recipient     = request.body.recipient;
    var message       = request.body.message_content;
    var message_date  = new Date(); 
    var messageQuery = {
        username     : username,
        recipient    : recipient,
        message      : message,
        message_date : message_date
    } 
    db.collection(messageCollection).save(messageQuery,function(error,dbres){
        if(error){
            alert('Some error occured');
            response.redirect('/home'); 
        } else {     
            response.redirect('/messages');    
        }  
    }); 
  
});     
/* end post message */

/* register route */
app.get('/register',function(request,response){ 
    if(request.session.login==1) {
        response.redirect('/home'); 
    } else {
        var postValues = [{"username":"","email":"","password":"","confirm":""}]; 
        response.render('register',{postValues:postValues[0]});                 
    }
}); 
/* end register route */

/* logout and clear session */
app.get('/logout',function(request,response) {  
    var username       = request.session.username;
    var loggedout_date = new Date();   
    io.on('connection', (socket) => { 
        socket.on('logout', (msg) => {   
            io.emit('logout',username+' logged out at: '+loggedout_date);   
        });         
        socket.on('disconnect', () => {
            io.emit('logout',username+' logged out at: '+loggedout_date);     
        });
    });  
    request.session.login==0;
    request.session.destroy();
    response.redirect('/');  
});  
/* end logout */

/* Listen app on port */
// app.listen(port,function(){
//     console.log('Server running on port: '+port);  
// });
server.listen(port,function(){
    console.log('Server running on port: '+port);  
});
/* End Listen */    