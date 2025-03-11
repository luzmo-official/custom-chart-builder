var r=({container:n,data:e})=>{let a=document.createElement("div");a.className="chart-wrapper",a.innerHTML=`
    <div class="chart-wrapper__title">Starter chart</div>
    <div class="chart-wrapper__content">data: ${JSON.stringify(e)}</div>
  `,n.appendChild(a)},t=n=>{console.log("resize",n)};export{r as render,t as resize};
