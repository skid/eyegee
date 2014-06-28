(function(){
  
/**
  Widget layout explanation:
  
    1. The page is divided in columns depending on the viewport width.
       The user can't control the number of columns, they are automatically added and removed
       when the screen width changes. These are all possible configurations
          
            1-Col            2-Col                    3-Col                            4-Col
           < 480px         480-720px                720-1280px                      1280 - 1920px
          +-------+    +-------+-------+    +-------+-------+-------+    +-------+-------+-------+-------+
          | [ A ] |    | [ A ] | [ B ] |    | [ A ] | [ B ] | [ C ] |    | [ A ] | [ B ] | [ C ] | [ D ] |
          | [ B ] |    | [ C ] | [ D ] |    | [ D ] |       |       |    |       |       |       |       |
          | [ C ] |    |       |       |    |       |       |       |    |       |       |       |       |
          | [ D ] |    |       |       |    |       |       |       |    |       |       |       |       |

       The 4 column setup is the maximum number of columns we can have.
       For horizontal rezolutions greater than 1920px the entire content will be centered in the screen.

    2. Each widget has a default order that is calculated from left to right THEN from top to bottom.
       If a new widget is added in the 2-Col layout it will automatically be assigned the order of "5" and be 
       placed directly under [ C ]. Later when the user resizes the screen and gets to a 3-Col layout,
       the new widget will be moved under [ B ].
    
    3. The user can re-arrange the widgets by dragging them in place of other widgets. As soon as the user 
       moves a single widget, ALL of the widgets positions for the current layout type are saved. Later, when 
       the layout is changed the widgets will arrange themselves according to the following rule:
          
          1. If the widget has a position preference for the current layout, use that.
          2. Otherwise order them by ID.
    
    4. The widget's position preferences are also saved when a user adds or removes a widget.

**/
  
})();
