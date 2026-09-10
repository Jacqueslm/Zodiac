/* Draws the share card: the twelve signs on a wheel, coloured by element,
   with the name. Rendered once to a PNG so every chat app can show it. */
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const SIGNS=[['♈','Aries','Fire'],['♉','Taurus','Earth'],['♊','Gemini','Air'],['♋','Cancer','Water'],
 ['♌','Leo','Fire'],['♍','Virgo','Earth'],['♎','Libra','Air'],['♏','Scorpio','Water'],
 ['♐','Sagittarius','Fire'],['♑','Capricorn','Earth'],['♒','Aquarius','Air'],['♓','Pisces','Water']];
const COL={Fire:'#f0894f',Earth:'#8fd08a',Air:'#8fc4f5',Water:'#8f9cf5'};
const R=200, CX=890, CY=315;
const marks=SIGNS.map(([g,,el],i)=>{
  const a=(i/12)*Math.PI*2 - Math.PI/2;
  const x=CX+Math.cos(a)*R, y=CY+Math.sin(a)*R;
  /* U+FE0E asks for the text glyph; without it Chromium substitutes an emoji
     font and the element colour is ignored, which is the one thing the wheel
     is supposed to show. */
  return `<text x="${x}" y="${y+13}" text-anchor="middle" font-size="38" fill="${COL[el]}">${g}&#xFE0E;</text>`;
}).join('');
const spokes=SIGNS.map((_,i)=>{
  const a=((i+0.5)/12)*Math.PI*2 - Math.PI/2;
  return `<line x1="${CX+Math.cos(a)*(R-38)}" y1="${CY+Math.sin(a)*(R-38)}"
    x2="${CX+Math.cos(a)*(R+34)}" y2="${CY+Math.sin(a)*(R+34)}" stroke="rgba(255,255,255,.10)" stroke-width="1"/>`;
}).join('');
const html=`<html><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"
     font-family="Georgia, 'Times New Roman', serif">
  <defs><radialGradient id="g" cx="72%" cy="46%" r="62%">
    <stop offset="0%" stop-color="#151030"/><stop offset="100%" stop-color="#07060d"/></radialGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="${CX}" cy="${CY}" r="${R+34}" fill="none" stroke="rgba(232,192,122,.30)" stroke-width="1.5"/>
  <circle cx="${CX}" cy="${CY}" r="${R-38}" fill="none" stroke="rgba(232,192,122,.16)" stroke-width="1"/>
  ${spokes}${marks}
  <text x="92" y="212" font-size="34" letter-spacing="9" fill="#e8c07a">PERSONOLOGY</text>
  <text x="88" y="316" font-size="92" fill="#ece9f5">Life&#8217;s Zodiacs</text>
  <text x="92" y="386" font-size="30" fill="#a29cbb">Every birthday, read in full.</text>
  <text x="92" y="432" font-size="30" fill="#a29cbb">The day, the week, the life it points to,</text>
  <text x="92" y="478" font-size="30" fill="#a29cbb">and what happens when two people meet.</text>
  <text x="92" y="556" font-size="23" letter-spacing="3" fill="#6f6890">366 DAYS &#183; 48 WEEKS &#183; 1,176 PAIRINGS</text>
</svg></body></html>`;
(async()=>{
  const b=await chromium.launch();
  const pg=await b.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
  await pg.setContent(html);
  await pg.screenshot({path:'/home/user/Zodiac/share.png'});
  await b.close();
  console.log('share.png written');
})();
