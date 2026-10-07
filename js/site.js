    function filterWorks(category, button) {
      document.querySelectorAll('.filter-btn').forEach(function (item) {
        item.classList.remove('bg-[#6366f1]', 'text-white');
        item.classList.add('border', 'border-[#252535]', 'text-[#8888a0]');
      });
      button.classList.add('bg-[#6366f1]', 'text-white');
      button.classList.remove('border', 'border-[#252535]', 'text-[#8888a0]');
      document.querySelectorAll('.work-card').forEach(function (card) {
        var isVisible = category === 'all' || card.dataset.category === category;
        card.classList.toggle('hidden', !isVisible);
      });
    }
  
(function(){var c=document.createElement('canvas');c.className='bg-particles';document.body.prepend(c);var x=c.getContext('2d');var w,h,p=[],N=42,D=120;function r(){w=c.width=innerWidth;h=c.height=innerHeight}r();addEventListener('resize',r);for(var i=0;i<N;i++)p.push({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5,r:Math.random()*1.5+.5});function a(){x.clearRect(0,0,w,h);p.forEach(function(q){q.x+=q.vx;q.y+=q.vy;if(q.x<0)q.x=w;if(q.x>w)q.x=0;if(q.y<0)q.y=h;if(q.y>h)q.y=0;x.beginPath();x.arc(q.x,q.y,q.r,0,7);x.fillStyle='rgba(100,100,160,.45)';x.fill()});for(var i=0;i<p.length;i++)for(var j=i+1;j<p.length;j++){var dx=p[i].x-p[j].x,dy=p[i].y-p[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<D){x.beginPath();x.moveTo(p[i].x,p[i].y);x.lineTo(p[j].x,p[j].y);x.strokeStyle='rgba(80,80,130,'+(0.15*(1-d/D))+')';x.lineWidth=.5;x.stroke()}}requestAnimationFrame(a)}a()})();

    function openPreview(id, title, tags, live) {
      document.getElementById('pmTitle').textContent = title;
      document.getElementById('pmTags').textContent = tags;
      document.getElementById('pmFrame').src = 'projects/' + id + '/index.html';
      var liveBtn = document.getElementById('pmLive');
      if (live) {
        liveBtn.href = live;
        liveBtn.style.display = 'inline-flex';
      } else {
        liveBtn.style.display = 'none';
      }
      var modal = document.getElementById('previewModal');
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
    function closePreview() {
      var modal = document.getElementById('previewModal');
      modal.style.display = 'none';
      document.getElementById('pmFrame').src = 'about:blank';
      document.body.style.overflow = '';
    }
    function showQr(src, title) {
      document.getElementById('qrTitle').textContent = title;
      document.getElementById('qrImg').src = src;
      document.getElementById('qrModal').style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
    function closeQr() {
      document.getElementById('qrModal').style.display = 'none';
      document.getElementById('qrImg').src = '';
      document.body.style.overflow = '';
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closePreview(); closeQr(); }
    });
  