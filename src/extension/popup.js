/**
 * Grove Keeper Extension — Popup UI
 */
(function() {
  chrome.runtime.sendMessage({ type: 'get_stats' }, function(stats) {
    if (!stats) return;

    document.getElementById('hashesToday').textContent = stats.hashesEarnedToday;
    document.getElementById('activeMinutes').textContent = stats.activeMinutesToday;
    document.getElementById('dailyProgress').textContent = stats.hashesEarnedToday + ' / ' + stats.dailyCap;
    document.getElementById('hourlyProgress').textContent = stats.hashesEarnedThisHour + ' / ' + stats.hourlyCap;
    document.getElementById('dailyBar').style.width = Math.round(stats.hashesEarnedToday / stats.dailyCap * 100) + '%';
    document.getElementById('hourlyBar').style.width = Math.round(stats.hashesEarnedThisHour / stats.hourlyCap * 100) + '%';

    var dot = document.getElementById('statusDot');
    var text = document.getElementById('statusText');
    if (stats.isActive) {
      dot.className = 'status-dot active';
      text.textContent = 'Actively earning hashes';
    } else {
      dot.className = 'status-dot idle';
      text.textContent = 'Idle — move your mouse to resume';
    }
  });
})();
