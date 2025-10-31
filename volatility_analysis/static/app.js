// 全局变量
var allRecords = [];
var canvas, ctx;
var currentFilter = '';
var selectedQuadrants = ['全部'];
var expandedDates = new Set();
var canvasRecords = [];
var earningsToggles = {}; // 存储每个日期的财报开关状态

// ==================== 改进的消息通知系统 ====================
function showMessage(text, type) {
    const container = document.getElementById('messageContainer');
    
    // 创建消息盒子
    const messageBox = document.createElement('div');
    messageBox.className = 'message-box';
    
    // 图标映射
    const iconMap = {
        'success': '✓',
        'error': '✕',
        'warning': '!'
    };
    
    // 默认显示时长（毫秒）
    const durationMap = {
        'success': 3000,
        'error': 4000,
        'warning': 3500
    };
    
    const duration = durationMap[type] || 3000;
    const icon = iconMap[type] || '•';
    
    messageBox.innerHTML = `
        <div class="message-icon ${type}">
            ${icon}
        </div>
        <div class="message-content">
            <span class="message-text ${type}">${text}</span>
        </div>
        <button class="message-close" onclick="this.closest('.message-box').remove()">
            ×
        </button>
    `;
    
    container.appendChild(messageBox);
    
    // 自动关闭
    if (duration > 0) {
        setTimeout(() => {
            if (messageBox.parentNode) {
                messageBox.classList.add('hide');
                setTimeout(() => {
                    messageBox.remove();
                }, 300);
            }
        }, duration);
    }
}

// ==================== Drawer 控制函数 ====================
function openInputDrawer() {
    document.getElementById('inputDrawerOverlay').classList.add('open');
    document.getElementById('inputDrawer').classList.add('open');
}

function closeInputDrawer() {
    document.getElementById('inputDrawerOverlay').classList.remove('open');
    document.getElementById('inputDrawer').classList.remove('open');
}

function openDetailDrawer() {
    document.getElementById('detailDrawerOverlay').classList.add('open');
    document.getElementById('detailDrawer').classList.add('open');
}

function closeDetailDrawer() {
    document.getElementById('detailDrawerOverlay').classList.remove('open');
    document.getElementById('detailDrawer').classList.remove('open');
}

// ==================== 数据分析函数 ====================
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
            closeInputDrawer();
            
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

// ==================== 加载记录函数 ====================
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
        
        if (!window.hasInitializedCanvas) {
            window.hasInitializedCanvas = true;
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

// ==================== 方向筛选相关函数 ====================
function toggleQuadrantDropdown() {
    var dropdown = document.getElementById('quadrantDropdown');
    dropdown.classList.toggle('open');
}

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

// 改进的方向筛选显示函数 - 显示所有选中项，用顿号分隔
function updateQuadrantDisplay() {
    var display = document.getElementById('quadrantSelected');
    
    if (selectedQuadrants.includes('全部')) {
        display.textContent = '全部';
    } else if (selectedQuadrants.length === 0) {
        display.textContent = '全部';
    } else {
        // 直接显示所有选中项，用顿号分隔
        display.textContent = selectedQuadrants.join('、');
    }
}

function filterRecords() {
    currentFilter = document.getElementById('dateFilterSelect').value;
    // 只重新渲染列表，不影响画布
    renderRecordsList();
    // 移除 drawQuadrant()，不重绘画布
}

function clearCanvas() {
    canvasRecords = [];
    drawQuadrant();
    showMessage('画布已清空', 'success');
}

// ==================== 辅助函数 ====================
function getQuadrantClass(quadrant) {
    // 支持两种破折号格式
    if (quadrant.includes('偏多') && quadrant.includes('买波')) {
        return 'bullish';
    } else if (quadrant.includes('偏空') && quadrant.includes('卖波')) {
        return 'bullish';
    } else if (quadrant.includes('偏多') && quadrant.includes('卖波')) {
        return 'bearish';
    } else if (quadrant.includes('偏空') && quadrant.includes('买波')) {
        return 'bearish';
    }
    return '';
}

function getBadgeClass(confidence) {
    if (confidence === '高') return 'badge-high';
    if (confidence === '中') return 'badge-medium';
    return 'badge-low';
}

// ==================== 渲染记录列表 ====================
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
    
    // Bug Fix: 方向筛选 - 支持中文破折号（——）和双短横线（--）
    if (!selectedQuadrants.includes('全部')) {
        for (var date in groupedByDate) {
            groupedByDate[date] = groupedByDate[date].filter(function(record) {
                var quadrant = record.quadrant || '';
                // 检查是否完全匹配
                if (selectedQuadrants.includes(quadrant)) {
                    return true;
                }
                // 转换破折号格式进行匹配
                var normalizedQuadrant = quadrant.replace(/—/g, '--');
                var matchFound = selectedQuadrants.some(function(selected) {
                    var normalizedSelected = selected.replace(/—/g, '--');
                    return normalizedQuadrant === normalizedSelected;
                });
                return matchFound;
            });
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
        html += '<div class="earnings-toggle">';
        html += '<span class="earnings-label">财报</span>';
        html += '<label class="switch">';
        var isChecked = earningsToggles[date] ? 'checked' : '';
        html += '<input type="checkbox" class="earnings-checkbox" data-date="' + date + '" ' + isChecked + '>';
        html += '<span class="slider">';
        html += '<span class="slider-text open">Open</span>';
        html += '<span class="slider-text close">Close</span>';
        html += '</span>';
        html += '</label>';
        html += '</div>';
        html += '<button class="btn-redraw" data-date="' + date + '">重绘</button>';
        html += '<button class="btn-delete-all" data-date="' + date + '">全部删除</button>';
        html += '</div>';
        html += '</div>';
        html += '<div class="date-content ' + (isExpanded ? 'expanded' : '') + '" id="content-' + date + '">';
        
        records.forEach(function(record) {
            var quadrantClass = getQuadrantClass(record.quadrant);
            var daysToEarnings = record.derived_metrics.days_to_earnings;
            var showEarnings = daysToEarnings !== null && daysToEarnings > 0;
            var eventIcon = record.earnings_event_enabled ? '✅' : '';
            
            html += '<div class="record-item" data-timestamp="' + record.timestamp + '" data-symbol="' + record.symbol + '">';
            html += '<div class="record-info">';
            html += '<div class="record-symbol">' + record.symbol + (eventIcon ? ' ' + eventIcon : '') + '</div>';
            html += '<div class="record-meta">';
            html += '<span class="record-quadrant ' + quadrantClass + '">' + record.quadrant + '</span>';
            html += '<span class="record-confidence">置信度: ' + record.confidence + '</span>';
            html += '<span class="record-liquidity">流动性: ' + record.liquidity + '</span>';
            if (showEarnings) {
                html += '<span class="record-earnings">财报: ' + daysToEarnings + '天</span>';
            }
            html += '</div></div>';
            html += '<button class="btn-delete-item" data-timestamp="' + record.timestamp + '" data-symbol="' + record.symbol + '">&times;</button>';
            html += '</div>';
        });
        
        html += '</div></div>';
    });
    
    container.innerHTML = html;
    container.addEventListener('click', handleRecordsListClick);
}

// ==================== 事件处理函数 ====================
function handleRecordsListClick(e) {
    var target = e.target;
    
    var dateHeader = target.closest('.date-header');
    if (dateHeader) {
        var date = dateHeader.getAttribute('data-date');
        if (date && !target.closest('.date-actions')) {
            toggleDateGroup(date);
            return;
        }
    }
    
    if (target.classList.contains('btn-redraw')) {
        e.stopPropagation();
        redrawDate(e, target.getAttribute('data-date'));
        return;
    }
    
    if (target.classList.contains('btn-delete-all')) {
        e.stopPropagation();
        deleteAllByDate(e, target.getAttribute('data-date'));
        return;
    }
    
    var recordItem = target.closest('.record-item');
    if (recordItem && !target.classList.contains('btn-delete-item')) {
        showDrawer(recordItem.getAttribute('data-timestamp'), recordItem.getAttribute('data-symbol'));
        return;
    }
    
    if (target.classList.contains('btn-delete-item')) {
        e.stopPropagation();
        deleteRecord(e, target.getAttribute('data-timestamp'), target.getAttribute('data-symbol'));
        return;
    }
    
    // 财报开关切换
    if (target.classList.contains('earnings-checkbox')) {
        e.stopPropagation();
        handleEarningsToggle(target);
        return;
    }
}

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

// ==================== 删除操作 ====================
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

function redrawDate(event, date) {
    event.stopPropagation();
    
    // 获取该日期的所有记录
    var dateRecords = allRecords.filter(function(r) {
        return r.timestamp.startsWith(date);
    });
    
    if (dateRecords.length === 0) {
        showMessage('该日期没有数据', 'error');
        return;
    }
    
    // 应用方向筛选
    var filteredDateRecords = dateRecords;
    if (!selectedQuadrants.includes('全部')) {
        filteredDateRecords = dateRecords.filter(function(record) {
            var quadrant = record.quadrant || '';
            // 完全匹配
            if (selectedQuadrants.includes(quadrant)) {
                return true;
            }
            // 转换破折号格式进行匹配
            var normalizedQuadrant = quadrant.replace(/—/g, '--');
            var matchFound = selectedQuadrants.some(function(selected) {
                var normalizedSelected = selected.replace(/—/g, '--');
                return normalizedQuadrant === normalizedSelected;
            });
            return matchFound;
        });
    }
    
    if (filteredDateRecords.length === 0) {
        showMessage('该日期没有符合筛选条件的数据', 'warning');
        return;
    }
    
    // 检查画布中是否已有其他日期的数据
    var otherDatesExist = canvasRecords.some(function(r) {
        return !r.timestamp.startsWith(date);
    });
    
    if (otherDatesExist) {
        // 清空画布，只加载当前日期的数据
        canvasRecords = filteredDateRecords;
        drawQuadrant();
        showMessage('已清空画布并重绘 ' + date + ' 的 ' + filteredDateRecords.length + ' 条数据', 'success');
    } else {
        // 检查该日期数据是否已在画布中
        var existingCount = canvasRecords.filter(function(r) {
            return r.timestamp.startsWith(date);
        }).length;
        
        if (existingCount > 0) {
            // 替换该日期的数据（支持重新筛选）
            canvasRecords = canvasRecords.filter(function(r) {
                return !r.timestamp.startsWith(date);
            });
            canvasRecords.push.apply(canvasRecords, filteredDateRecords);
            drawQuadrant();
            showMessage('已更新 ' + date + ' 的 ' + filteredDateRecords.length + ' 条数据', 'success');
        } else {
            // 添加该日期的数据
            canvasRecords.push.apply(canvasRecords, filteredDateRecords);
            drawQuadrant();
            showMessage('已重绘 ' + date + ' 的 ' + filteredDateRecords.length + ' 条数据', 'success');
        }
    }
}

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

// ==================== 财报事件处理 ====================
async function handleEarningsToggle(checkbox) {
    var date = checkbox.getAttribute('data-date');
    var ignoreEarnings = checkbox.checked;
    
    // 保存开关状态
    earningsToggles[date] = ignoreEarnings;
    
    showMessage('正在重新计算 ' + date + ' 的数据...', 'warning');
    
    // 获取该日期的原始数据
    var dateRecords = allRecords.filter(function(r) {
        return r.timestamp.startsWith(date);
    });
    
    if (dateRecords.length === 0) {
        showMessage('该日期没有数据', 'error');
        return;
    }
    
    // 提取原始数据
    var rawDataList = dateRecords.map(function(r) { return r.raw_data; });
    
    try {
        // 调用后端API重新计算，传递ignore_earnings参数
        var response = await fetch('/api/analyze?ignore_earnings=' + ignoreEarnings, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ records: rawDataList })
        });
        
        var result = await response.json();
        
        if (response.ok && result.results) {
            // 标记这些记录是否启用了财报事件
            result.results.forEach(function(r) {
                r.earnings_event_enabled = ignoreEarnings;
            });
            
            // 更新allRecords中的数据
            allRecords = allRecords.filter(function(r) {
                return !r.timestamp.startsWith(date);
            });
            allRecords.push.apply(allRecords, result.results);
            
            // 如果画布中有该日期的数据，也需要更新
            var hasDateInCanvas = canvasRecords.some(function(r) {
                return r.timestamp.startsWith(date);
            });
            
            if (hasDateInCanvas) {
                // 应用方向筛选
                var filteredResults = result.results;
                if (!selectedQuadrants.includes('全部')) {
                    filteredResults = result.results.filter(function(record) {
                        var quadrant = record.quadrant || '';
                        if (selectedQuadrants.includes(quadrant)) return true;
                        var normalizedQuadrant = quadrant.replace(/—/g, '--');
                        return selectedQuadrants.some(function(selected) {
                            var normalizedSelected = selected.replace(/—/g, '--');
                            return normalizedQuadrant === normalizedSelected;
                        });
                    });
                }
                
                // 更新画布数据
                canvasRecords = canvasRecords.filter(function(r) {
                    return !r.timestamp.startsWith(date);
                });
                canvasRecords.push.apply(canvasRecords, filteredResults);
                drawQuadrant();
            }
            
            // 重新渲染列表
            renderRecordsList();
            
            showMessage('已' + (ignoreEarnings ? '开启' : '关闭') + '财报事件计算', 'success');
        } else {
            showMessage('重新计算失败: ' + (result.error || '未知错误'), 'error');
            // 恢复开关状态
            checkbox.checked = !ignoreEarnings;
            earningsToggles[date] = !ignoreEarnings;
        }
    } catch (e) {
        showMessage('重新计算失败: ' + e.message, 'error');
        // 恢复开关状态
        checkbox.checked = !ignoreEarnings;
        earningsToggles[date] = !ignoreEarnings;
    }
}

// ==================== 详情抽屉 ====================
function showDrawer(timestamp, symbol) {
    var record = allRecords.find(function(r) {
        return r.timestamp === timestamp && r.symbol === symbol;
    });
    
    if (!record) return;
    
    var eventIcon = record.earnings_event_enabled ? ' ✅' : '';
    document.getElementById('detailDrawerTitle').textContent = record.symbol + eventIcon + ' - 详细分析';
    
    var confidenceBadge = getBadgeClass(record.confidence);
    var quadrantClass = getQuadrantClass(record.quadrant);
    var daysToEarnings = record.derived_metrics.days_to_earnings;
    var showEarnings = daysToEarnings !== null && daysToEarnings > 0;
    
    var html = '<p style="color: #00000045; margin-bottom: 20px;">' + record.timestamp + '</p>';
    html += '<div class="detail-section"><h3>核心结论</h3>';
    html += '<div class="detail-row"><div class="detail-label">四象限定位:</div><div class="detail-value"><strong><span class="record-quadrant ' + quadrantClass + '">' + record.quadrant + '</span></strong></div></div>';
    html += '<div class="detail-row"><div class="detail-label">置信度:</div><div class="detail-value"><span class="badge ' + confidenceBadge + '">' + record.confidence + '</span></div></div>';
    html += '<div class="detail-row"><div class="detail-label">流动性:</div><div class="detail-value">' + record.liquidity + '</div></div>';
    if (showEarnings) {
        html += '<div class="detail-row"><div class="detail-label">距离财报:</div><div class="detail-value">' + daysToEarnings + ' 天</div></div>';
    }
    if (record.earnings_event_enabled) {
        html += '<div class="detail-row"><div class="detail-label">财报事件:</div><div class="detail-value">✅ 已开启</div></div>';
    }
    html += '<div class="detail-row"><div class="detail-label">方向评分:</div><div class="detail-value">' + record.direction_score + ' (' + record.direction_bias + ')</div></div>';
    html += '<div class="detail-row"><div class="detail-label">波动评分:</div><div class="detail-value">' + record.vol_score + ' (' + record.vol_bias + ')</div></div></div>';
    
    html += '<div class="detail-section"><h3>衍生指标</h3>';
    html += '<div class="detail-row"><div class="detail-label">IVRV 比值:</div><div class="detail-value">' + record.derived_metrics.ivrv_ratio + '</div></div>';
    html += '<div class="detail-row"><div class="detail-label">IVRV 差值:</div><div class="detail-value">' + record.derived_metrics.ivrv_diff + '</div></div>';
    html += '<div class="detail-row"><div class="detail-label">Regime 比值:</div><div class="detail-value">' + record.derived_metrics.regime_ratio + '</div></div>';
    html += '<div class="detail-row"><div class="detail-label">Call/Put 比值:</div><div class="detail-value">' + record.derived_metrics.cp_ratio + '</div></div>';
    html += '<div class="detail-row"><div class="detail-label">距离财报天数:</div><div class="detail-value">' + (record.derived_metrics.days_to_earnings !== null ? record.derived_metrics.days_to_earnings + ' 天' : '无财报') + '</div></div></div>';
    
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
    html += '<div class="detail-row"><div class="detail-value" style="color: #ff4d4f;">' + record.risk + '</div></div></div>';
    
    document.getElementById('detailDrawerContent').innerHTML = html;
    openDetailDrawer();
}

// ==================== 四象限图绘制 ====================
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
    
    // 绘制背景区域
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#52c41a';
    ctx.fillRect(padding, padding, centerX - padding, centerY - padding);
    ctx.fillStyle = '#faad14';
    ctx.fillRect(centerX, padding, width - centerX - padding, centerY - padding);
    ctx.fillStyle = '#ff4d4f';
    ctx.fillRect(padding, centerY, centerX - padding, height - centerY - padding);
    ctx.fillStyle = '#1890ff';
    ctx.fillRect(centerX, centerY, width - centerX - padding, height - centerY - padding);
    ctx.globalAlpha = 1.0;
    
    // 绘制主轴线
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
    
    // 绘制网格线
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
    
    // 绘制当前画布日期标记
    if (canvasRecords.length > 0) {
        // 获取画布中所有日期
        var datesInCanvas = {};
        canvasRecords.forEach(function(r) {
            var date = r.timestamp.split(' ')[0];
            datesInCanvas[date] = (datesInCanvas[date] || 0) + 1;
        });
        
        // 按日期排序
        var sortedDates = Object.keys(datesInCanvas).sort();
        
        // 绘制日期标签
        ctx.fillStyle = '#1890ff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        if (sortedDates.length === 1) {
            // 单个日期
            var dateText = sortedDates[0] + ' (' + datesInCanvas[sortedDates[0]] + '条)';
            ctx.fillText(dateText, centerX, 15);
        } else if (sortedDates.length <= 3) {
            // 多个日期，显示详情
            var dateTexts = sortedDates.map(function(date) {
                return date + '(' + datesInCanvas[date] + ')';
            });
            ctx.fillText(dateTexts.join(' | '), centerX, 15);
        } else {
            // 太多日期，显示总数
            var totalCount = canvasRecords.length;
            ctx.fillText(sortedDates.length + '个日期，共' + totalCount + '条数据', centerX, 15);
        }
    }
    
    // 绘制轴标签
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('买波', centerX, padding - 15);
    ctx.fillText('卖波', centerX, height - padding + 30);
    ctx.textAlign = 'left';
    ctx.fillText('偏空', padding + 5, centerY - 10);
    ctx.textAlign = 'right';
    ctx.fillText('偏多', width - padding - 5, centerY - 10);
    
    // 绘制象限标签
    ctx.font = 'bold 13px Arial';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.fillText('偏空--买波', padding + (centerX - padding) / 2, padding + 25);
    ctx.fillText('偏多--买波', centerX + (width - centerX - padding) / 2, padding + 25);
    ctx.fillText('偏空--卖波', padding + (centerX - padding) / 2, height - padding - 15);
    ctx.fillText('偏多--卖波', centerX + (width - centerX - padding) / 2, height - padding - 15);
    
    // 筛选要显示的记录 - 画布不受日期筛选影响，只受方向筛选影响
    var filteredRecords = canvasRecords.filter(function(r) {
        // 移除日期筛选判断: if (currentFilter && !r.timestamp.startsWith(currentFilter)) return false;
        if (selectedQuadrants.includes('全部')) return true;
        
        var quadrant = r.quadrant || '';
        // 完全匹配
        if (selectedQuadrants.includes(quadrant)) return true;
        
        // 转换破折号格式匹配
        var normalizedQuadrant = quadrant.replace(/—/g, '--');
        return selectedQuadrants.some(function(selected) {
            var normalizedSelected = selected.replace(/—/g, '--');
            return normalizedQuadrant === normalizedSelected;
        });
    });
    
    if (!Array.isArray(filteredRecords) || filteredRecords.length === 0) {
        ctx.fillStyle = '#999';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', centerX, centerY);
        return;
    }
    
    // 计算点的位置
    var points = filteredRecords.map(function(record) {
        var xRange = record.direction_score >= 0 ? (width - centerX - padding) : (centerX - padding);
        var yRange = record.vol_score >= 0 ? (centerY - padding) : (height - centerY - padding);
        var x = centerX + (record.direction_score / 5) * xRange;
        var y = centerY - (record.vol_score / 5) * yRange;
        return { record: record, x: x, y: y };
    });
    
    // 防止点重叠
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
    
    // 绘制数据点
    points.forEach(function(item) {
        var record = item.record;
        var x = item.x;
        var y = item.y;
        
        var color;
        if (record.confidence === '高') {
            color = '#52c41a';
        } else if (record.confidence === '中') {
            color = '#faad14';
        } else {
            color = '#ff4d4f';
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

function handleCanvasClick(event) {
    if (!Array.isArray(canvasRecords) || canvasRecords.length === 0) return;
    
    var rect = canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    
    // 画布点击筛选 - 不受日期筛选影响
    var filteredRecords = canvasRecords.filter(function(r) {
        // 移除日期筛选判断: if (currentFilter && !r.timestamp.startsWith(currentFilter)) return false;
        if (selectedQuadrants.includes('全部')) return true;
        
        var quadrant = r.quadrant || '';
        if (selectedQuadrants.includes(quadrant)) return true;
        
        var normalizedQuadrant = quadrant.replace(/—/g, '--');
        return selectedQuadrants.some(function(selected) {
            var normalizedSelected = selected.replace(/—/g, '--');
            return normalizedQuadrant === normalizedSelected;
        });
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

// ==================== 加载日期列表 ====================
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

// ==================== 窗口调整和全局事件监听 ====================
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

// ==================== 页面加载完成初始化 ====================
window.onload = function() {
    loadRecords();
    loadDates();
    
    // 绑定按钮事件
    document.getElementById('btnAnalyze').addEventListener('click', openInputDrawer);
    document.getElementById('btnSubmitAnalyze').addEventListener('click', analyzeData);
    document.getElementById('btnCancelAnalyze').addEventListener('click', closeInputDrawer);
    document.getElementById('btnCloseInputDrawer').addEventListener('click', closeInputDrawer);
    document.getElementById('btnClear').addEventListener('click', clearCanvas);
    document.getElementById('dateFilterSelect').addEventListener('change', filterRecords);
    document.getElementById('quadrantSelectBtn').addEventListener('click', toggleQuadrantDropdown);
    document.getElementById('detailDrawerOverlay').addEventListener('click', closeDetailDrawer);
    document.getElementById('btnCloseDetailDrawer').addEventListener('click', closeDetailDrawer);
    document.getElementById('inputDrawerOverlay').addEventListener('click', closeInputDrawer);
    
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