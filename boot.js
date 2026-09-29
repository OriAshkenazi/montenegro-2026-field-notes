// Runs before first paint so the page renders in the saved language and direction without a flash.
(function(){var l='he';try{if(localStorage.getItem('mne-lang')==='en')l='en';}catch(e){}var d=document.documentElement;d.lang=l;d.dir=l==='he'?'rtl':'ltr';d.setAttribute('data-lang',l);setTimeout(function(){d.classList.add('i18n-ready');},1500);})();
