// 全局变量
var allRecords = [];
var canvas, ctx;
var currentFilter = '';
var selectedQuadrants = ['全部'];
var expandedDates = new Set();
var canvasRecords = [];

// 显示消息
function showMessage(text, type) {
    var msg = document.getElementById('message');
    msg.textContent = text;
    msg.className = 'message ' + type;
    msg.style.display = 'block';
    setTimeout(function() {
        msg.style.display = 'none';
    }, 3000);
}

// 分析数据
async function analyzeData() {
    var input = document.getElementById('dataInput').value.trim();
    
    if (!input) {
        showMessage('请输入数据', 'error');
        return;
    }
    
    try {
        input = input.replace(/^\s*\w+\s*=\s*/, '').replace(/;\s*$/, '');
        var records = JSON.parse(input);
        
        if (!Array.isArray(records)) {
            showMessage('数据必须是数组格式', 'error');
            return;
        }
        
        if (records.length === 0) {
            showMessage('数据数组不能为空', 'error');
            return;
        }
        
        var response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ records: records })
        });
        
        var result = await response.json();
        
        if (response.ok) {
            showMessage(result.message, 'success');
            document.getElementById('dataInput').value = '';
            
            var newDates = new Set();
            if (result.results && Array.isArray(result.results)) {
                result.results.forEach(function(r) {
                    var date = r.timestamp.split(' ')[0];
                    newDates.add(date);
                });
                
                canvasRecords.push.apply(canvasRecords, result.results);
            }
            
            await loadRecords();
            await loadDates();
            
            newDates.forEach(function(date) {
                expandedDates.add(date);
                var content = document.getElementById('content-' + date);
                var toggle = document.getElementById('toggle-' + date);
                if (content && toggle) {
                    content.classList.add('expanded');
                    toggle.classList.add('expanded');
                }
            });
        } else {
            showMessage(result.error || '分析失败', 'error');
        }
    } catch (e) {
        showMessage('数据格式错误: ' + e.message, 'error');
    }
}

// 加载记录
async function loadRecords() {
    try {
        var response = await fetch('/api/records');
        if (!response.ok) {
            allRecords = [];
            canvasRecords = [];
            renderRecordsList();
            drawQuadrant();
            return;
        }
        
        var data = await response.json();
        allRecords = Array.isArray(data) ? data : [];
        
        // Bug Fix: 避免重复加载,只在第一次加载或重置后才初始化画布
        // 使用标志位判断是否是首次加载
        if (!window.hasInitializedCanvas) {
            window.hasInitializedCanvas = true;
            
            // 只显示当天数据
            var today = new Date();
            var todayStr = today.getFullYear() + '-' + 
                          String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(today.getDate()).padStart(2, '0');
            
            var todayRecords = allRecords.filter(function(r) {
                return r.timestamp.startsWith(todayStr);
            });
            
            canvasRecords = todayRecords;
        }
        
        renderRecordsList();
        drawQuadrant();
    } catch (e) {
        console.error('加载数据异常:', e);
        allRecords = [];
        canvasRecords = [];
        renderRecordsList();
        drawQuadrant();
    }
}

// 切换方向下拉框
function toggleQuadrantDropdown() {
    var dropdown = document.getElementById('quadrantDropdown');
    dropdown.classList.toggle('open');
}

// 处理方向筛选变化
function handleQuadrantChange(e) {
    var allCheckbox = document.getElementById('quad-all');
    var checkboxes = [
        document.getElementById('quad-1'),
        document.getElementById('quad-2'),
        document.getElementById('quad-3'),
        document.getElementById('quad-4'),
        document.getElementById('quad-5')
    ];
    
    var targetId = e.target.id;
    
    if (targetId === 'quad-all') {
        if (allCheckbox.checked) {
            checkboxes.forEach(function(cb) { cb.checked = false; });
            selectedQuadrants = ['全部'];
        }
    } else {
        allCheckbox.checked = false;
        selectedQuadrants = checkboxes.filter(function(cb) { return cb.checked; })
                                       .map(function(cb) { return cb.value; });
        
        if (selectedQuadrants.length === 0) {
            allCheckbox.checked = true;
            selectedQuadrants = ['全部'];
        }
    }
    
    updateQuadrantDisplay();
    filterRecords();
}

// 更新方向筛选显示
function updateQuadrantDisplay() {
    var display = document.getElementById('quadrantSelected');
    if (selectedQuadrants.includes('全部')) {
        display.textContent = '全部';
    } else if (selectedQuadrants.length === 0) {
        display.textContent = '全部';
    } else if (selectedQuadrants.length === 1) {
        display.textContent = selectedQuadrants[0];
    } else {
        display.textContent = '已选 ' + selectedQuadrants.length + ' 项';
    }
}

// 筛选记录
function filterRecords() {
    currentFilter = document.getElementById('dateFilterSelect').value;
    renderRecordsList();
    drawQuadrant();
}

// 清空画布
function clearCanvas() {
    canvasRecords = [];
    drawQuadrant();
    showMessage('画布已清空', 'success');
}

// 渲染记录列表
function renderRecordsList() {
    var container = document.getElementById('recordsList');
    
    if (!allRecords || allRecords.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无数据,请先提交分析</div>';
        return;
    }
    
    var groupedByDate = {};
    allRecords.forEach(function(record) {
        var date = record.timestamp.split(' ')[0];
        
        if (currentFilter && date !== currentFilter) {
            return;
        }
        
        if (!groupedByDate[date]) {
            groupedByDate[date] = [];
        }
        groupedByDate[date].push(record);
    });
    
    // Bug Fix: 先完成分组,再应用方向筛选
    // 如果方向筛选不是"全部",则过滤记录
    if (!selectedQuadrants.includes('全部')) {
        for (var date in groupedByDate) {
            groupedByDate[date] = groupedByDate[date].filter(function(record) {
                return selectedQuadrants.includes(record.quadrant);
            });
            // 如果该日期下没有符合条件的记录,删除该日期
            if (groupedByDate[date].length === 0) {
                delete groupedByDate[date];
            }
        }
    }
    
    var sortedDates = Object.keys(groupedByDate).sort().reverse();
    
    if (sortedDates.length === 0) {
        container.innerHTML = '<div class="empty-state">没有符合条件的数据</div>';
        return;
    }
    
    var html = '';
    sortedDates.forEach(function(date) {
        var records = groupedByDate[date];
        var count = records.length;
        var isExpanded = expandedDates.has(date);
        
        html += '<div class="date-group">';
        html += '<div class="date-header" data-date="' + date + '">';
        html += '<div class="date-title">';
        html += '<span class="date-toggle ' + (isExpanded ? 'expanded' : '') + '" id="toggle-' + date + '">▼</span>';
        html += '<span>' + date + ' (' + count + '条)</span>';
        html += '</div>';
        html += '<div class="date-actions">';
        html += '<button class="btn-redraw" data-date="' + date + '">重绘</button>';
        html += '<button class="btn-delete-all" data-date="' + date + '">全部删除</button>';
        html += '</div>';
        html += '</div>';
        html += '<div class="date-content ' + (isExpanded ? 'expanded' : '') + '" id="content-' + date + '">';
        
        records.forEach(function(record) {
            html += '<div class="record-item" data-timestamp="' + record.timestamp + '" data-symbol="' + record.symbol + '">';
            html += '<div class="record-info">';
            html += '<div class="record-symbol">' + record.symbol + '</div>';
            html += '<div class="record-meta">';
            html += '<span>' + record.quadrant + '</span>';
            html += '<span class="badge ' + getBadgeClass(record.confidence) + '">' + record.confidence + '</span>';
            html += '<span>流动性: ' + record.liquidity + '</span>';
            html += '</div></div>';
            html += '<button class="btn-delete-item" data-timestamp="' + record.timestamp + '" data-symbol="' + record.symbol + '">&times;</button>';
            html += '</div>';
        });
        
        html += '</div></div>';
    });
    
    container.innerHTML = html;
    
    // 使用事件委托绑定事件
    container.addEventListener('click', handleRecordsListClick);
}

// 新增: 独立的事件处理函数,避免重复绑定
function handleRecordsListClick(e) {
    var target = e.target;
    
    // 日期标题点击
    var dateHeader = target.closest('.date-header');
    if (dateHeader) {
        var date = dateHeader.getAttribute('data-date');
        if (date && !target.closest('.date-actions')) {
            toggleDateGroup(date);
            return;
        }
    }
    
    // 重绘按钮
    if (target.classList.contains('btn-redraw')) {
        e.stopPropagation();
        redrawDate(e, target.getAttribute('data-date'));
        return;
    }
    
    // 删除全部按钮
    if (target.classList.contains('btn-delete-all')) {
        e.stopPropagation();
        deleteAllByDate(e, target.getAttribute('data-date'));
        return;
    }
    
    // 记录项点击
    var recordItem = target.closest('.record-item');
    if (recordItem && !target.classList.contains('btn-delete-item')) {
        showDrawer(recordItem.getAttribute('data-timestamp'), recordItem.getAttribute('data-symbol'));
        return;
    }
    
    // 删除单条
    if (target.classList.contains('btn-delete-item')) {
        e.stopPropagation();
        deleteRecord(e, target.getAttribute('data-timestamp'), target.getAttribute('data-symbol'));
        return;
    }
}

// 获取徽章样式
function getBadgeClass(confidence) {
    if (confidence === '高') return 'badge-high';
    if (confidence === '中') return 'badge-medium';
    return 'badge-low';
}

// 切换日期组展开/折叠
function toggleDateGroup(date) {
    var content = document.getElementById('content-' + date);
    var toggle = document.getElementById('toggle-' + date);
    
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        toggle.classList.remove('expanded');
        expandedDates.delete(date);
    } else {
        content.classList.add('expanded');
        toggle.classList.add('expanded');
        expandedDates.add(date);
    }
}

// 删除所有记录(按日期)
async function deleteAllByDate(event, date) {
    event.stopPropagation();
    
    try {
        var response = await fetch('/api/records/date/' + date, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showMessage('已删除 ' + date + ' 的所有记录', 'success');
            
            canvasRecords = canvasRecords.filter(function(r) {
                return !r.timestamp.startsWith(date);
            });
            
            await loadRecords();
            await loadDates();
        } else {
            showMessage('删除失败', 'error');
        }
    } catch (e) {
        showMessage('删除失败: ' + e.message, 'error');
    }
}

// 重绘指定日期
function redrawDate(event, date) {
    event.stopPropagation();
    
    var dateRecords = allRecords.filter(function(r) {
        return r.timestamp.startsWith(date);
    });
    
    if (dateRecords.length === 0) {
        showMessage('该日期没有数据', 'error');
        return;
    }
    
    var existingCount = canvasRecords.filter(function(r) {
        return r.timestamp.startsWith(date);
    }).length;
    
    if (existingCount > 0) {
        showMessage('画布中已存在 ' + date + ' 的数据', 'error');
        return;
    }
    
    canvasRecords.push.apply(canvasRecords, dateRecords);
    drawQuadrant();
    showMessage('已重绘 ' + date + ' 的 ' + dateRecords.length + ' 条数据', 'success');
}

// 删除单条记录
async function deleteRecord(event, timestamp, symbol) {
    event.stopPropagation();
    
    var date = timestamp.split(' ')[0];
    var wasExpanded = expandedDates.has(date);
    
    try {
        var response = await fetch('/api/records/' + encodeURIComponent(timestamp) + '/' + encodeURIComponent(symbol), {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showMessage('删除成功', 'success');
            
            if (wasExpanded) {
                expandedDates.add(date);
            }
            
            canvasRecords = canvasRecords.filter(function(r) {
                return !(r.timestamp === timestamp && r.symbol === symbol);
            });
            
            await loadRecords();
        } else {
            showMessage('删除失败', 'error');
        }
    } catch (e) {
        showMessage('删除失败: ' + e.message, 'error');
    }
}

// 显示详情抽屉
function showDrawer(timestamp, symbol) {
    var record = allRecords.find(function(r) {
        return r.timestamp === timestamp && r.symbol === symbol;
    });
    
    if (!record) return;
    
    document.getElementById('drawerTitle').textContent = record.symbol + ' - 详细分析';
    
    var confidenceBadge = getBadgeClass(record.confidence);
    
    var html = '<p style="color: #666; margin-bottom: 20px;">' + record.timestamp + '</p>';
    html += '<div class="detail-section"><h3>核心结论</h3>';
    html += '<div class="detail-row"><div class="detail-label">四象限定位:</div><div class="detail-value"><strong>' + record.quadrant + '</strong></div></div>';
    html += '<div class="detail-row"><div class="detail-label">置信度:</div><div class="detail-value"><span class="badge ' + confidenceBadge + '">' + record.confidence + '</span></div></div>';
    html += '<div class="detail-row"><div class="detail-label">流动性:</div><div class="detail-value">' + record.liquidity + '</div></div>';
    html += '<div class="detail-row"><div class="detail-label">方向评分:</div><div class="detail-value">' + record.direction_score + ' (' + record.direction_bias + ')</div></div>';
    html += '<div class="detail-row"><div class="detail-label">波动评分:</div><div class="detail-value">' + record.vol_score + ' (' + record.vol_bias + ')</div></div></div>';
    
    html += '<div class="detail-section"><h3>派生指标</h3>';
    html += '<div class="detail-row"><div class="detail-label">IVRV 比值:</div><div class="detail-value">' + record.derived_metrics.ivrv_ratio + '</div></div>';
    html += '<div class="detail-row"><div class="detail-label">IVRV 差值:</div><div class="detail-value">' + record.derived_metrics.ivrv_diff + '</div></div>';
    html += '<div class="detail-row"><div class="detail-label">Regime 比值:</div><div class="detail-value">' + record.derived_metrics.regime_ratio + '</div></div>';
    html += '<div class="detail-row"><div class="detail-label">Call/Put 比值:</div><div class="detail-value">' + record.derived_metrics.cp_ratio + '</div></div>';
    html += '<div class="detail-row"><div class="detail-label">距财报天数:</div><div class="detail-value">' + (record.derived_metrics.days_to_earnings !== null ? record.derived_metrics.days_to_earnings + ' 天' : '无财报') + '</div></div></div>';
    
    html += '<div class="detail-section"><h3>方向驱动因素</h3><ul class="factor-list">';
    record.direction_factors.forEach(function(f) {
        html += '<li>' + f + '</li>';
    });
    html += '</ul></div>';
    
    html += '<div class="detail-section"><h3>波动驱动因素</h3><ul class="factor-list">';
    record.vol_factors.forEach(function(f) {
        html += '<li>' + f + '</li>';
    });
    html += '</ul></div>';
    
    html += '<div class="detail-section"><h3>策略建议</h3>';
    html += '<div class="detail-row"><div class="detail-value">' + record.strategy + '</div></div></div>';
    
    html += '<div class="detail-section"><h3>风险提示</h3>';
    html += '<div class="detail-row"><div class="detail-value" style="color: #e74c3c;">' + record.risk + '</div></div></div>';
    
    document.getElementById('drawerContent').innerHTML = html;
    document.getElementById('drawerOverlay').classList.add('open');
    document.getElementById('drawer').classList.add('open');
}

// 关闭抽屉
function closeDrawer() {
    document.getElementById('drawerOverlay').classList.remove('open');
    document.getElementById('drawer').classList.remove('open');
}

// 绘制四象限图
function drawQuadrant() {
    if (!canvas) {
        canvas = document.getElementById('quadrantCanvas');
        ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        canvas.addEventListener('click', handleCanvasClick);
    }
    
    var width = canvas.width;
    var height = canvas.height;
    var centerX = width / 2;
    var centerY = height / 2;
    var padding = 80;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(padding, padding, centerX - padding, centerY - padding);
    ctx.fillStyle = '#ff9800';
    ctx.fillRect(centerX, padding, width - centerX - padding, centerY - padding);
    ctx.fillStyle = '#f44336';
    ctx.fillRect(padding, centerY, centerX - padding, height - centerY - padding);
    ctx.fillStyle = '#ffc107';
    ctx.fillRect(centerX, centerY, width - centerX - padding, height - centerY - padding);
    ctx.globalAlpha = 1.0;
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, centerY);
    ctx.lineTo(width - padding, centerY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX, padding);
    ctx.lineTo(centerX, height - padding);
    ctx.stroke();
    
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    for (var i = 1; i <= 3; i++) {
        var xRight = centerX + (i * (width - centerX - padding) / 4);
        ctx.beginPath();
        ctx.moveTo(xRight, padding);
        ctx.lineTo(xRight, height - padding);
        ctx.stroke();
        
        var xLeft = centerX - (i * (centerX - padding) / 4);
        ctx.beginPath();
        ctx.moveTo(xLeft, padding);
        ctx.lineTo(xLeft, height - padding);
        ctx.stroke();
        
        var yDown = centerY + (i * (height - centerY - padding) / 4);
        ctx.beginPath();
        ctx.moveTo(padding, yDown);
        ctx.lineTo(width - padding, yDown);
        ctx.stroke();
        
        var yUp = centerY - (i * (centerY - padding) / 4);
        ctx.beginPath();
        ctx.moveTo(padding, yUp);
        ctx.lineTo(width - padding, yUp);
        ctx.stroke();
    }
    
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('买波', centerX, padding - 15);
    ctx.fillText('卖波', centerX, height - padding + 30);
    ctx.textAlign = 'left';
    ctx.fillText('偏空', padding + 5, centerY - 10);
    ctx.textAlign = 'right';
    ctx.fillText('偏多', width - padding - 5, centerY - 10);
    
    ctx.font = 'bold 13px Arial';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.fillText('偏空—买波', padding + (centerX - padding) / 2, padding + 25);
    ctx.fillText('偏多—买波', centerX + (width - centerX - padding) / 2, padding + 25);
    ctx.fillText('偏空—卖波', padding + (centerX - padding) / 2, height - padding - 15);
    ctx.fillText('偏多—卖波', centerX + (width - centerX - padding) / 2, height - padding - 15);
    
    var filteredRecords = canvasRecords.filter(function(r) {
        if (currentFilter && !r.timestamp.startsWith(currentFilter)) return false;
        if (!selectedQuadrants.includes('全部') && !selectedQuadrants.includes(r.quadrant)) return false;
        return true;
    });
    
    if (!Array.isArray(filteredRecords) || filteredRecords.length === 0) {
        ctx.fillStyle = '#999';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', centerX, centerY);
        return;
    }
    
    var points = filteredRecords.map(function(record) {
        var xRange = record.direction_score >= 0 ? (width - centerX - padding) : (centerX - padding);
        var yRange = record.vol_score >= 0 ? (centerY - padding) : (height - centerY - padding);
        var x = centerX + (record.direction_score / 5) * xRange;
        var y = centerY - (record.vol_score / 5) * yRange;
        return { record: record, x: x, y: y };
    });
    
    var minDistance = 30;
    for (var i = 0; i < points.length; i++) {
        for (var j = i + 1; j < points.length; j++) {
            var dx = points[j].x - points[i].x;
            var dy = points[j].y - points[i].y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < minDistance && dist > 0) {
                var angle = Math.atan2(dy, dx);
                var offset = (minDistance - dist) / 2;
                points[j].x += Math.cos(angle) * offset;
                points[j].y += Math.sin(angle) * offset;
                points[i].x -= Math.cos(angle) * offset;
                points[i].y -= Math.sin(angle) * offset;
            }
        }
    }
    
    points.forEach(function(item) {
        var record = item.record;
        var x = item.x;
        var y = item.y;
        
        var color;
        if (record.confidence === '高') {
            color = '#27ae60';
        } else if (record.confidence === '中') {
            color = '#f39c12';
        } else {
            color = '#e74c3c';
        }
        
        ctx.fillStyle = color;
        ctx.font = 'bold 14px "Comic Sans MS", cursive, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(record.symbol, x, y);
        
        var textWidth = ctx.measureText(record.symbol).width;
        record._canvasX = x;
        record._canvasY = y;
        record._clickRadius = Math.max(textWidth / 2 + 5, 15);
    });
}

// 处理画布点击
function handleCanvasClick(event) {
    if (!Array.isArray(canvasRecords) || canvasRecords.length === 0) return;
    
    var rect = canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    
    var filteredRecords = canvasRecords.filter(function(r) {
        if (currentFilter && !r.timestamp.startsWith(currentFilter)) return false;
        if (!selectedQuadrants.includes('全部') && !selectedQuadrants.includes(r.quadrant)) return false;
        return true;
    });
    
    for (var i = 0; i < filteredRecords.length; i++) {
        var record = filteredRecords[i];
        if (!record._canvasX || !record._canvasY) continue;
        
        var dx = x - record._canvasX;
        var dy = y - record._canvasY;
        var distance = Math.sqrt(dx * dx + dy * dy);
        var clickRadius = record._clickRadius || 15;
        
        if (distance <= clickRadius) {
            showDrawer(record.timestamp, record.symbol);
            return;
        }
    }
}

// 加载日期列表
async function loadDates() {
    try {
        var response = await fetch('/api/dates');
        if (!response.ok) return;
        
        var dates = await response.json();
        var select = document.getElementById('dateFilterSelect');
        var currentValue = select.value;
        select.innerHTML = '<option value="">全部日期</option>';
        
        dates.forEach(function(date) {
            var option = document.createElement('option');
            option.value = date;
            option.textContent = date;
            select.appendChild(option);
        });
        
        select.value = currentValue;
    } catch (e) {
        console.error('加载日期异常:', e);
    }
}

// 窗口大小调整
window.addEventListener('resize', function() {
    if (canvas) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        drawQuadrant();
    }
});

// 点击外部关闭下拉框
document.addEventListener('click', function(e) {
    var filter = document.querySelector('.quadrant-filter');
    var dropdown = document.getElementById('quadrantDropdown');
    if (filter && !filter.contains(e.target)) {
        dropdown.classList.remove('open');
    }
});

// 页面加载完成
window.onload = function() {
    loadRecords();
    loadDates();
    
    // 绑定按钮事件
    document.getElementById('btnAnalyze').addEventListener('click', analyzeData);
    document.getElementById('btnClear').addEventListener('click', clearCanvas);
    document.getElementById('dateFilterSelect').addEventListener('change', filterRecords);
    document.getElementById('quadrantSelectBtn').addEventListener('click', toggleQuadrantDropdown);
    document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);
    document.getElementById('btnCloseDrawer').addEventListener('click', closeDrawer);
    
    // 绑定checkbox事件
    var allCheckbox = document.getElementById('quad-all');
    var checkboxIds = ['quad-1', 'quad-2', 'quad-3', 'quad-4', 'quad-5'];
    
    if (allCheckbox) {
        allCheckbox.addEventListener('change', handleQuadrantChange);
    }
    
    checkboxIds.forEach(function(id) {
        var cb = document.getElementById(id);
        if (cb) {
            cb.addEventListener('change', handleQuadrantChange);
        }
    });
};