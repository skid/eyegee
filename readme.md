# EyeGee: replaces iGoogle

This is a small stand-alone node.js application that will replace iGoogle.
As much as possible and as much as I have time to work on it.

## About

I developed EyeGee to suit my personal longing for an ad-free as-simple-as-possible personalized homepage. I used to have a bunch of RSS feeds, a dilbert comic and xkcd on iGoogle and that worked fine for me ... but, you know, leave it to Google/Apple/Facebook to create and then screw up the stuff you like.

So, if you are interested, by all means use EyeGee. Help improve it, make some widgets, find bugs. I don't have much time to work on the project, and, to be honest it's quite useful for me as it is - but I will try to provide any help.

## Running EyeGee

To run EyeGee on your server, you're gonna need [node.js](http://nodejs.org) and [redis](http://redis.io). You already have git, I assume.

So, first: clone the repository from github:

    git clone git@github.com:skid/eyegee.git

Go to the cloned directoy and install dependencies:

    cd eyegee
    npm install

Also, you will need to install bower because it's used to manage the frontend libraries.

		npm install -g bower

And then install the frontend dependencies:

		bower install angular angular-route angular-sanitize angular-ui-utils#keypress angular-widgetbox microload

Make a settings.json file in the top directory and put the following json there:

		{
		  "hostname":       "http://127.0.0.1:3001",
		  "sess_max_age":   84600,
		  "cache_ttl":      600,
		  "forgotten_ttl":  600,
		  "email_port":     587,
		  "email_user":     "",
		  "email_password": "", 
		  "email_host":     "", 
		  "email_domain":   "",
		  "email_ssl":      false,
		  "email_tls":      true
		}

Eyegee uses a connection to a SMTP server to be able to email you in case you lose your password. I added this feature to allow other people to create accounts. If you plan to have a local installation, you should probably edit the `server.js` file and remove the email code.

Make sure the Redis server is running and then start the development server:

    node server.js

And finally visit [http://127.0.0.1:3001](http://127.0.0.1:3001).

## Contributing

Eyegee has very simple backend code. It's 500 lines long and it's in the `server.js` file. Basically, it's used for 3 things: serving static content, database I/O and as a proxy for pulling resources from the web. Everything else is done on the frontend.

Eyegee is organized in widget apps which are placed in `/static`. So far, there are 3 of them - *comic*, *notes* and *rss* are widgets and *main* is the main application that bootstraps everything and loads the other widgets if needed.

Eyegee is made with [Angular.js](https://angularjs.org/). It's my first angular project ever, so you'll have to excuse any terrible code you may find.

There are no special development dependencies. I personally use gulp with gulp-less, but it's up to you to manage your own css.

### Making new widgets

A widget is a self-contained folder inside the `/static` dir which contains at least 3 files:

		+ widget_name
			- controller.js
			- widget.html
			- styles.css

When the server starts, EyeGee will assume that all folders (except for *main*) are widget modules and it will load them and allow the user to add them to the dashboard.
