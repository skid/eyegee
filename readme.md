## EyeGee - iGoogle replacement

This is a small stand-alone node.js application that will replace iGoogle.
As much as possible and as much as I have time to work on it.




#### User

The user is defined in a redis key like this:

"user:jordanovskid@gmail.com" {"widgets":[{"type":"rss","href":"http://feeds.arstechnica.com/arstechnica/index"}],"columns":3,"search_engine":"google"}

The sessions are defined as:

"sess:55f2c2425245-cookie-id" "jordanovskid@gmail.com"

The cached pages are defined as a sorted set:

"feed:http://feeds.arstechnica.com/arstechnica/index" timestamp "blob of the rss xml"




The feeds are fetched only if they haven't been requested in the last 5 minutes
The keys expire after 1 day (of non usage)


# We need a Daily chess problem