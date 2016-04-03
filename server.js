
//Initializations
var express = require("express");
//npm install body-parser --save
var bodyParser = require("body-parser");
// npm install js-sha256 --save
var sha256 = require('js-sha256');
// npm install csprng --save
var rand = require('csprng');
// npm install pg --save
 var pg = require("pg");
// npm install express-session --save
var session = require('express-session');
// npm install connect-pg-simple --save
var PostgreSqlStore = require('connect-pg-simple')(session);



var app = express();
var dbConnect = process.env.DATABASE_URL || "postgres://postgres:root@123@localhost:5432/portfolio";
var cookieSecret = process.env.COOKIE_SECRET || "tq2pdxrblkbgp8vt8kbdpmzdh1w8bex";

	
// session management
var sessionOptions = {
  secret: cookieSecret,
  resave : true,
  saveUninitialized : false,
  store : new PostgreSqlStore({
  	pg: pg,
    conString: dbConnect
  })
};
app.use(session(sessionOptions));
var sess;


//Configurations
app.set("port",(process.env.PORT||5000));
app.set('view engine', 'ejs');
app.use(express.static(__dirname + "/public"));
var sha256Ex = require(__dirname +"/public/assets/javascript/sha256hash");



//Parses POST requests. The Content-type in the HTTP request header is set to application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({type:"application/x-www-form-urlencoded"}));


//Route handler - index page
app.get("/", function(request, response){
	response.render("pages/index");
});

//Route handler - index page
app.get("/index", function(request, response){
	response.render("pages/index");
});

//Route handler - portfolio page 
app.get("/portfolio", function(request, response){
	response.render("pages/portfolio");
});
//Route handler - GET request contact page
app.get("/contact", function(request, response){
	response.render("pages/contact");
});

//Route handler - POST request to contact page
app.post("/contact", function(request, response) {

	var requestParam = {
		name : request.body.fullname,
		email : request.body.email,
		subject : request.body.subject,
		message: request.body.message || null,
	};
	
	persist(response, requestParam, "contact_info"); // Save data to database	
});

//Route handler - GET request to admin page
app.get("/adminPage", function(request, response){
	
	sess = request.session;
	if(typeof sess !== 'undefined' && sess.mobile){
		renderAdminPage(response);
	}
	else{
		response.render('pages/admin');
	}	
});

//Route handlers - POST request to admin page
app.post("/adminPage", function(request, response) {

	sess = request.session;
	if(typeof sess !== 'undefined' && sess.mobile){
		renderAdminPage(response);
	}
	else{
		var requestParam = {
			mobile : request.body.mobile,
			password : request.body.adminpass,
		};
		userAuthenticate(requestParam, response);		// authenticate user
	}
});

//Route handler - logout
app.get("/logout", function(request, response){

	sess = request.session;
	if(typeof sess !== "undefined" && sess.mobile){
		request.session.destroy(function(err){
			if(err){
				console.log("Error destroying session: " + err);
				response.render("pages/errorPage", {status: 500, error: "Internal Server Error"});
			}
		});
		response.render("pages/admin");
	}

});


// Renders admin page
function renderAdminPage(response){
	console.log("Inside render admin page");
	pg.connect(dbConnect, function(err, client, done) {

		if(err){
			done();
			console.log("Not able to connect to database: " + err);
			return response.render('pages/errorPage', {status: 500, error: "Internal Server Error...We will get back to you shortly"} ); 
		}

		client.query('SELECT * FROM public.contact_info;', function(err, result) {
			done();

			if (err){
				console.log(err);
				return response.render('pages/errorPage', {status: 500, error: "Internal Server Error...We will get back to you shortly"} ); 
			}
			else{ 
				return response.render('pages/adminPage', {results: result.rows, session:sess} ); 
			}

		});
	});
}


// function to authenticate user
function userAuthenticate(requestParam, response){

	var res, results = [];

	function userCheck(arg){

		if(arg["mobile"] == requestParam["mobile"]){

			// Password to check - sha256(salt + sha256(password)) is cross checked against existing password
			var passCheck = sha256(arg["salt"] + requestParam.password);

			if(passCheck == arg["hash_pwd"]){
	      		sess.mobile = requestParam.mobile;
				return renderAdminPage(response);				
			}
			else{				
				return response.render('pages/errorPage', {status: 401, error: "Invalid user name or password!"} ); 
			}
		}
		else{	
			return response.render('pages/errorPage', {status: 401, error: "Invalid user name or password!"}); 
		}

	}

	pg.connect(dbConnect, function(err, client, done){

		// Handling connection errors
		if(err){
			done();
			console.log("Error getting connection: " + err);
			return response.render('pages/errorPage', {status: 500, error: "Internal Server Error...We will get back to you.."} ); 
		}

 		var selectQuery = 'SELECT mobile, name, hash_pwd, salt FROM public.user_account WHERE mobile = \'' + String(requestParam.mobile) + '\';';


		var query = client.query(selectQuery, function(err){
			if(err){
				done();
				console.log("Error in query: " + err);
				return response.render('pages/errorPage', {status: 500, error: "Internal Server Error...We will get back to you.."} ); 
			}
		});

		query.on('row', function(row, result) {				
       		results.push(row);
    	});

    	query.on('end', function() {
            done();
			
            if(results.length == 1){        
            	res = results.pop(0);
            	results = [];            	
            	return userCheck(res);
            }
            else{
            	console.log("Error: Fetched more than one row");
            	return response.render('pages/errorPage', {status: 500, error: "Internal Server Error...We will get back to you.."} ); 
            }	
        });
 		
	});
}

// Function to save data
function persist(response, requestParam, table){

	console.log("Inside persist function");
	pg.connect(dbConnect, function(err, client, done){

		// Handling connection errors
		if(err){
			done();
			console.log("Error getting connection: " + err);
			return response.render('pages/errorPage', {status: 500, error: "Internal Server Error...We will get back to you.."} ); 
		}

 		var query, argList;

 		if(table == "contact_info"){
 			query = "INSERT INTO public.contact_info(name,email,subject,message) values ($1, $2, $3, $4)";
 			argList = [];
 			for(var prop in requestParam)
 				argList.push(requestParam[prop]);
 		}

		client.query(query, argList ,function(err, result){
			
			done();
			if(err){
				console.log("Error in query: " + err);
				return response.render('pages/errorPage', {status: 500, error: "Internal Server Error...We will get back to you.."} ); 
			}
			else{
				console.log("success storing to database");
				return response.render("pages/contact");
			}
		});
	});
}

//Listening to port for requests
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
