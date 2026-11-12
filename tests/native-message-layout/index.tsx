import React, {useState, useEffect} from 'react';
import {registerRootComponent} from 'expo';
import {View, Pressable, Text} from 'react-native';
import {UserMessageBubble} from '../../src/components/UserMessageBubble';
import {Markdown} from '../../src/components/Markdown';
import {ThemeProvider} from '../../src/lib/theme';
import {BetaLayoutContext} from '../../src/lib/betaLayout';
const text = `Initial set of feedback:

1. add a header that says "Latest models" in a row with a refresh button on the right
2. The loading state can be made simpler, just show a circular progress loader
3. Make the widget always respect the system light/dark theme with the default color scheme but if dynamic color color is enabled then pull colors from the wallpaper.`;
function Demo(){
 const [items,setItems]=useState([{id:'first',text}]);
 const [beta,setBeta]=useState(true);
 const [width,setWidth]=useState(393);
 useEffect(()=>{let step=0;const cases=[{w:393,b:true,n:1},{w:360,b:true,n:1},{w:320,b:true,n:1},{w:393,b:false,n:1},{w:360,b:false,n:1},{w:320,b:false,n:1}];const timer=setInterval(()=>{const c=cases[step++];if(!c){clearInterval(timer);return;}console.log('REPRO45_CASE',JSON.stringify(c));setWidth(c.w);setBeta(c.b);setItems(Array.from({length:c.n},(_,i)=>({id:'m'+i,text})));},1800);return()=>clearInterval(timer);},[]);
 Object.assign(globalThis,{setReproItems:setItems,setReproBeta:setBeta,setReproWidth:setWidth});
 return <BetaLayoutContext.Provider value={beta}><ThemeProvider><View style={{height:800,width,padding:16,backgroundColor:'#171717'}}><Pressable onPress={()=>setItems(v=>[...v,{id:`m${v.length}`,text}])}><Text>Send</Text></Pressable><UserMessageBubble><Markdown text={text}/></UserMessageBubble></View></ThemeProvider></BetaLayoutContext.Provider>;
}
registerRootComponent(Demo);
