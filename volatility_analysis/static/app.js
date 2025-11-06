var allRecords = [];
var canvas, ctx;
var currentFilter = '';
var selectedQuadrants = ['全部'];
var expandedDates = new Set();
var canvasRecords = [];
var earningsToggles = {};

function showMessage(text, type) {
    const container = document.getElementById('messageContainer');
    const messageBox = document.createElement('div');
    messageBox.className = 'message-box';
    
    const iconMap = {
        'success': '✓',
        'error': '✕',
        'warning': '!'
    };
    
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
        console.error('Load data error:', e);
        allRecords = [];
        canvasRecords = [];
        renderRecordsList();
        drawQuadrant();
    }
}

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

function updateQuadrantDisplay() {
    var display = document.getElementById('quadrantSelected');
    
    if (selectedQuadrants.includes('全部')) {
        display.textContent = '全部';
    } else if (selectedQuadrants.length === 0) {
        display.textContent = '全部';
    } else {
        display.textContent = selectedQuadrants.join('、');
    }
}

function filterRecords() {
    currentFilter = document.getElementById('dateFilterSelect').value;
    renderRecordsList();
}

function clearCanvas() {
    canvasRecords = [];
    drawQuadrant();
    showMessage('画布已清空', 'success');
}

function getQuadrantClass(quadrant) {
    if (quadrant.includes('偏多') && quadrant.includes('买波')) {
        return 'quad-bull-buy'; // 偏多—买波
    } else if (quadrant.includes('偏多') && quadrant.includes('卖波')) {
        return 'quad-bull-sell'; // 偏多—卖波
    } else if (quadrant.includes('偏空') && quadrant.includes('买波')) {
        return 'quad-bear-buy'; // 偏空—买波
    } else if (quadrant.includes('偏空') && quadrant.includes('卖波')) {
        return 'quad-bear-sell'; // 偏空—卖波
    } else if (quadrant.includes('中性')) {
        return 'quad-neutral'; // 中性/待观察
    }
    return '';
}

// [新增] 辅助函数：根据流动性获取CSS类
function getLiquidityClass(liquidity) {
    if (liquidity === '高') return 'liquidity-high';
    if (liquidity === '中') return 'liquidity-medium';
    if (liquidity === '低') return 'liquidity-low';
    return '';
}

function getBadgeClass(confidence) {
    if (confidence === '高') return 'badge-high';
    if (confidence === '中') return 'badge-medium';
    return 'badge-low';
}

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
    
    if (!selectedQuadrants.includes('全部')) {
        for (var date in groupedByDate) {
            groupedByDate[date] = groupedByDate[date].filter(function(record) {
                var quadrant = record.quadrant || '';
                if (selectedQuadrants.includes(quadrant)) {
                    return true;
                }
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
        
        html += '<div class="date-group" data-date="' + date + '">';
        html += '<div class="date-header sticky" data-date="' + date + '">';
        html += '<div class="date-title">';
        html += '<span class="date-toggle ' + (isExpanded ? 'expanded' : '') + '" id="toggle-' + date + '">▼</span>';
        html += '<span>' + date + ' (' + count + '条)</span>';
        html += '</div>';
        html += '<div class="date-actions">';
        html += '<div class="earnings-toggle">';
        html += '<label class="switch">';
        var isChecked = earningsToggles[date] ? 'checked' : '';
        html += '<input type="checkbox" class="earnings-checkbox" data-date="' + date + '" ' + isChecked + '>';
        html += '<span class="slider">';
        html += '<span class="slider-text open">E-ON</span>';
        html += '<span class="slider-text close">E-OFF</span>';
        html += '</span>';
        html += '</label>';
        html += '</div>';
        html += '<button class="icon-btn" data-date="' + date + '" data-action="redraw" title="重绘"><svg t="1761983191932" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="10970" width="300" height="300"><path d="M242.27 421.75v131.84c0 12.1 8.41 23.29 20.56 25.21a24.541 24.541 0 0 0 28.82-23.89v-71.86c0-7.72 6.38-13.97 14.23-13.97 7.88 0 14.26 6.25 14.26 13.97v42.32c0 12.1 8.38 23.27 20.53 25.21 7.11 1.26 14.4-0.67 19.96-5.27 5.55-4.6 8.81-11.41 8.89-18.62v-43.63c0-7.72 6.37-13.97 14.21-13.97 7.88 0 14.26 6.25 14.26 13.97v19.82c0 7.98 6.59 14.47 14.71 14.47 8.12 0 14.71-6.49 14.71-14.47v-15.1c0-10.32 8.53-18.69 19.03-18.69h10.35c10.49 0 19.02 8.36 19.02 18.69 0 13.39 11.05 24.25 24.7 24.25 13.64 0 24.68-10.86 24.68-24.25v-18.69h177.29v-71.88H242.27v24.54z m0 0" fill="#FFB74D" p-id="10971"></path><path d="M744.88 271.25h-17.81v50.82h17.81c14.28 0 25.88 11.43 25.88 25.42v137.3c0 14.02-11.59 25.42-25.88 25.42H607.15c-42.82 0-77.64 34.19-77.64 76.24v24.56h51.76v-24.56c0-14.02 11.6-25.45 25.88-25.45h137.73c42.79 0 77.63-34.17 77.63-76.22V347.5c0-42.06-34.84-76.25-77.63-76.25z m0 0" fill="#607D8B" p-id="10972"></path><path d="M522.26 611a8.09 8.09 0 0 0-8.17 8.03c0 4.45 3.67 8.02 8.17 8.02h66.25a8.09 8.09 0 0 0 8.17-8.02 8.09 8.09 0 0 0-8.17-8.03h-66.25z m0 0" fill="#E2543F" p-id="10973"></path><path d="M503.61 757.16c-5.2 31.29 19.45 59.73 51.75 59.73s56.93-28.46 51.71-59.73l-21.56-130.11H525.2l-21.59 130.11z m0 0" fill="#EB6C57" p-id="10974"></path><path d="M245.79 386.24c-1.25 0-2.33-0.55-3.52-0.72v11.64h460.29v-11.64c-1.22 0.14-2.3 0.72-3.55 0.72H245.79z m0 0" fill="#FB8C00" p-id="10975"></path><path d="M727.07 235.19c0-15.5-12.55-28.08-28.08-28.08h-453.2c-15.5 0-28.08 12.58-28.08 28.08v122.97c0 14.25 10.78 25.57 24.54 27.39 1.2 0.17 2.28 0.72 3.52 0.72h453.2c1.27 0 2.35-0.55 3.55-0.72 13.91-1.65 24.42-13.38 24.51-27.39V235.19h0.04z m0 0" fill="#FFB74D" p-id="10976"></path><path d="M201.49 275.02h16.22v43.32h-16.22z" fill="#FB8C00" p-id="10977"></path></svg></button>';
        html += '<button class="icon-btn delete-all" data-date="' + date + '" data-action="delete" title="全部删除"><svg t="1761998227002" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="15528" width="256" height="256"><path d="M512 311.893333m-178.773333 0a178.773333 178.773333 0 1 0 357.546666 0 178.773333 178.773333 0 1 0-357.546666 0Z" fill="#FF354A" p-id="15529"></path><path d="M746.666667 890.88H277.333333c-47.146667 0-85.333333-38.186667-85.333333-85.333333v-384c0-47.146667 38.186667-85.333333 85.333333-85.333334h469.333334c47.146667 0 85.333333 38.186667 85.333333 85.333334v384c0 47.146667-38.186667 85.333333-85.333333 85.333333z" fill="#2953FF" p-id="15530"></path><path d="M345.386667 708.48v-149.333333a53.333333 53.333333 0 0 1 106.666666 0v149.333333a53.333333 53.333333 0 0 1-106.666666 0zM571.946667 708.48v-149.333333a53.333333 53.333333 0 0 1 106.666666 0v149.333333a53.333333 53.333333 0 0 1-106.666666 0z" fill="#93A8FF" p-id="15531"></path><path d="M857.813333 397.226667H166.186667C133.333333 397.226667 106.666667 370.56 106.666667 337.706667v-8.746667c0-32.853333 26.666667-59.52 59.52-59.52H857.6c32.853333 0 59.52 26.666667 59.52 59.52v8.746667a59.221333 59.221333 0 0 1-59.306667 59.52z" fill="#FCCA1E" p-id="15532"></path></svg></button>';
        html += '</div>';
        html += '</div>';
        html += '<div class="date-content ' + (isExpanded ? 'expanded' : '') + '" id="content-' + date + '">';
        
        records.forEach(function(record) {
            var quadrantClass = getQuadrantClass(record.quadrant);
            var daysToEarnings = record.derived_metrics.days_to_earnings;
            var showEarnings = daysToEarnings !== null && daysToEarnings > 0;
            var eventBadge = record.earnings_event_enabled ? '<span class="earnings-badge">E</span>' : '';
            
            var dirScore = record.direction_score;
            var volScore = record.vol_score;
            var dirColor = dirScore > 0 ? '#00C853' : (dirScore < 0 ? '#FF3B30' : '#9E9E9E');
            var volColor = volScore > 0 ? '#00C853' : (volScore < 0 ? '#FF3B30' : '#9E9E9E');
            
            // [更新] 获取流动性CSS类
            var confidenceBadge = getBadgeClass(record.confidence);
            var liquidityClass = getLiquidityClass(record.liquidity);

            html += '<div class="record-item" data-timestamp="' + record.timestamp + '" data-symbol="' + record.symbol + '">';
            html += '<div class="record-info">';
            html += '<div class="record-symbol">' + record.symbol + eventBadge + '</div>';
            html += '<div class="record-meta">';
            html += '<span class="record-quadrant ' + quadrantClass + '">' + record.quadrant + '</span>';
            // [更新] 应用流动性CSS类
            html += '<span class="record-confidence">置信度: <span class="badge ' + confidenceBadge + '">' + record.confidence + '</span></span>';
            html += '<span class="record-liquidity ' + liquidityClass + '">流动性: ' + record.liquidity + '</span>';
            
            html += '<span class="record-score-dir" style="color: ' + dirColor + ';">方向: ' + dirScore + '</span>';
            html += '<span class="record-score-vol" style="color: ' + volColor + ';">波动: ' + volScore + '</span>';
            
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
    
    var iconBtn = target.closest('.icon-btn');
    if (iconBtn) {
        e.stopPropagation();
        var date = iconBtn.getAttribute('data-date');
        var action = iconBtn.getAttribute('data-action');
        
        if (action === 'redraw') {
            redrawDate(e, date);
        } else if (action === 'delete') {
            deleteAllByDate(e, date);
        }
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
    
    var dateRecords = allRecords.filter(function(r) {
        return r.timestamp.startsWith(date);
    });
    
    if (dateRecords.length === 0) {
        showMessage('该日期没有数据', 'error');
        return;
    }
    
    var filteredDateRecords = dateRecords;
    if (!selectedQuadrants.includes('全部')) {
        filteredDateRecords = dateRecords.filter(function(record) {
            var quadrant = record.quadrant || '';
            if (selectedQuadrants.includes(quadrant)) {
                return true;
            }
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
    
    var otherDatesExist = canvasRecords.some(function(r) {
        return !r.timestamp.startsWith(date);
    });
    
    if (otherDatesExist) {
        canvasRecords = filteredDateRecords;
        drawQuadrant();
        showMessage('已清空画布并重绘 ' + date + ' 的 ' + filteredDateRecords.length + ' 条数据', 'success');
    } else {
        var existingCount = canvasRecords.filter(function(r) {
            return r.timestamp.startsWith(date);
        }).length;
        
        if (existingCount > 0) {
            canvasRecords = canvasRecords.filter(function(r) {
                return !r.timestamp.startsWith(date);
            });
            canvasRecords.push.apply(canvasRecords, filteredDateRecords);
            drawQuadrant();
            showMessage('已更新 ' + date + ' 的 ' + filteredDateRecords.length + ' 条数据', 'success');
        } else {
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

async function handleEarningsToggle(checkbox) {
    var date = checkbox.getAttribute('data-date');
    var ignoreEarnings = checkbox.checked;
    
    earningsToggles[date] = ignoreEarnings;
    
    showMessage('正在重新计算 ' + date + ' 的数据...', 'warning');
    
    var dateRecords = allRecords.filter(function(r) {
        return r.timestamp.startsWith(date);
    });
    
    if (dateRecords.length === 0) {
        showMessage('该日期没有数据', 'error');
        return;
    }
    
    var rawDataList = dateRecords.map(function(r) { return r.raw_data; });
    
    try {
        var response = await fetch('/api/analyze?ignore_earnings=' + ignoreEarnings, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ records: rawDataList })
        });
        
        var result = await response.json();
        
        if (response.ok && result.results) {
            result.results.forEach(function(r) {
                r.earnings_event_enabled = ignoreEarnings;
            });
            
            allRecords = allRecords.filter(function(r) {
                return !r.timestamp.startsWith(date);
            });
            allRecords.push.apply(allRecords, result.results);
            
            var hasDateInCanvas = canvasRecords.some(function(r) {
                return r.timestamp.startsWith(date);
            });
            
            if (hasDateInCanvas) {
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
                
                canvasRecords = canvasRecords.filter(function(r) {
                    return !r.timestamp.startsWith(date);
                });
                canvasRecords.push.apply(canvasRecords, filteredResults);
                drawQuadrant();
            }
            
            renderRecordsList();
            
            showMessage('已' + (ignoreEarnings ? '开启' : '关闭') + '财报事件计算', 'success');
        } else {
            showMessage('重新计算失败: ' + (result.error || '未知错误'), 'error');
            checkbox.checked = !ignoreEarnings;
            earningsToggles[date] = !ignoreEarnings;
        }
    } catch (e) {
        showMessage('重新计算失败: ' + e.message, 'error');
        checkbox.checked = !ignoreEarnings;
        earningsToggles[date] = !ignoreEarnings;
    }
}

function showDrawer(timestamp, symbol) {
    var record = allRecords.find(function(r) {
        return r.timestamp === timestamp && r.symbol === symbol;
    });
    
    if (!record) return;
    
    var eventBadge = record.earnings_event_enabled ? ' <span class="earnings-badge">E</span>' : '';
    document.getElementById('detailDrawerTitle').innerHTML = record.symbol + eventBadge + ' - 详细分析';
    
    var confidenceBadge = getBadgeClass(record.confidence);
    var quadrantClass = getQuadrantClass(record.quadrant);
    var daysToEarnings = record.derived_metrics.days_to_earnings;
    var showEarnings = daysToEarnings !== null && daysToEarnings > 0;
    
    var dirScore = record.direction_score;
    var volScore = record.vol_score;
    var dirColor = dirScore > 0 ? '#00C853' : (dirScore < 0 ? '#FF3B30' : '#9E9E9E');
    var volColor = volScore > 0 ? '#00C853' : (volScore < 0 ? '#FF3B30' : '#9E9E9E');

    // [更新] 获取流动性CSS类
    var liquidityClass = getLiquidityClass(record.liquidity);

    var html = '<p class="timestamp">' + record.timestamp + '</p>';
    html += '<div class="detail-section"><h3>核心结论</h3>';
    html += '<div class="detail-row"><div class="detail-label">四象限定位:</div><div class="detail-value"><strong><span class="record-quadrant ' + quadrantClass + '">' + record.quadrant + '</span></strong></div></div>';
    html += '<div class="detail-row"><div class="detail-label">置信度:</div><div class="detail-value"><span class="badge ' + confidenceBadge + ' detail-value-highlight">' + record.confidence + '</span></div></div>';
    // [更新] 应用流动性CSS类
    html += '<div class="detail-row"><div class="detail-label">流动性:</div><div class="detail-value"><span class="detail-value-liquidity ' + liquidityClass + '">' + record.liquidity + '</span></div></div>';
    if (showEarnings) {
        html += '<div class="detail-row"><div class="detail-label">距离财报:</div><div class="detail-value">' + daysToEarnings + ' 天</div></div>';
    }
    if (record.earnings_event_enabled) {
        html += '<div class="detail-row"><div class="detail-label">财报事件:</div><div class="detail-value">✅ 已开启</div></div>';
    }
    
    html += '<div class="detail-row"><div class="detail-label">方向评分:</div><div class="detail-value" style="color: ' + dirColor + '; font-weight: bold;">' + record.direction_score + ' (' + record.direction_bias + ')</div></div>';
    html += '<div class="detail-row"><div class="detail-label">波动评分:</div><div class="detail-value" style="color: ' + volColor + '; font-weight: bold;">' + record.vol_score + ' (' + record.vol_bias + ')</div></div></div>';
    
    html += '<div class="detail-section"><h3>衍生指标</h3>';
    html += '<div class="detail-row"><div class="detail-label">IVRV 比值:</div><div class="detail-value">' + record.derived_metrics.ivrv_ratio + '</div></div>';
    html += '<div class="detail-row"><div class="detail-label">IVRV 差值:</div><div class="detail-value">' + record.derived_metrics.ivrv_diff + '</div></div>';
    html += '<div class="detail-row"><div class="detail-label">Regime 比值:</div><div class="detail-value">' + record.derived_metrics.regime_ratio + '</div></div>';
    html += '<div class="detail-row"><div class="detail-label">Call/Put 比值:</div><div class="detail-value">' + record.derived_metrics.cp_ratio + '</div></div>';
    if (showEarnings) {
        html += '<div class="detail-row"><div class="detail-label">距离财报天数:</div><div class="detail-value">' + daysToEarnings + ' 天</div></div>';
    }
    html += '</div>';
    
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
    html += '<div class="detail-row"><div class="detail-value risk-text">' + record.risk + '</div></div></div>';
    
    document.getElementById('detailDrawerContent').innerHTML = html;
    openDetailDrawer();
}

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
    
    var size = Math.min(width, height);
    var centerX = width / 2;
    var centerY = height / 2;
    
    var paddingRatio = size < 600 ? 0.08 : (size < 800 ? 0.10 : 0.12);
    var padding = Math.max(50, size * paddingRatio);
    
    var quadrantSize = Math.min(width - 2 * padding, height - 2 * padding);
    var halfQuadrant = quadrantSize / 2;
    
    var left = centerX - halfQuadrant;
    var right = centerX + halfQuadrant;
    var top = centerY - halfQuadrant;
    var bottom = centerY + halfQuadrant;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#34C759'; // 偏空—买波
    ctx.fillRect(left, top, halfQuadrant, halfQuadrant);
    ctx.fillStyle = '#00C853'; // 偏多—买波
    ctx.fillRect(centerX, top, halfQuadrant, halfQuadrant);
    ctx.fillStyle = '#007AFF'; // 偏空—卖波
    ctx.fillRect(left, centerY, halfQuadrant, halfQuadrant);
    ctx.fillStyle = '#FF9500'; // 偏多—卖波
    ctx.fillRect(centerX, centerY, halfQuadrant, halfQuadrant);
    ctx.globalAlpha = 1.0;
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, centerY);
    ctx.lineTo(right, centerY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX, top);
    ctx.lineTo(centerX, bottom);
    ctx.stroke();
    
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    for (var i = 1; i <= 3; i++) {
        var xRight = centerX + (i * halfQuadrant / 4);
        ctx.beginPath();
        ctx.moveTo(xRight, top);
        ctx.lineTo(xRight, bottom);
        ctx.stroke();
        
        var xLeft = centerX - (i * halfQuadrant / 4);
        ctx.beginPath();
        ctx.moveTo(xLeft, top);
        ctx.lineTo(xLeft, bottom);
        ctx.stroke();
        
        var yDown = centerY + (i * halfQuadrant / 4);
        ctx.beginPath();
        ctx.moveTo(left, yDown);
        ctx.lineTo(right, yDown);
        ctx.stroke();
        
        var yUp = centerY - (i * halfQuadrant / 4);
        ctx.beginPath();
        ctx.moveTo(left, yUp);
        ctx.lineTo(right, yUp);
        ctx.stroke();
    }
    
    ctx.setLineDash([]);
    
    if (canvasRecords.length > 0) {
        var datesInCanvas = {};
        canvasRecords.forEach(function(r) {
            var date = r.timestamp.split(' ')[0];
            datesInCanvas[date] = (datesInCanvas[date] || 0) + 1;
        });
        
        var sortedDates = Object.keys(datesInCanvas).sort();
        
        ctx.fillStyle = '#1890ff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        if (sortedDates.length === 1) {
            var dateText = sortedDates[0] + ' (' + datesInCanvas[sortedDates[0]] + ')';
            ctx.fillText(dateText, centerX, 10);
        } else if (sortedDates.length <= 3) {
            var dateTexts = sortedDates.map(function(date) {
                return date + '(' + datesInCanvas[date] + ')';
            });
            ctx.fillText(dateTexts.join(' | '), centerX, 10);
        } else {
            var totalCount = canvasRecords.length;
            ctx.fillText(sortedDates.length + ' dates, ' + totalCount + ' records', centerX, 10);
        }
    }
    
    ctx.fillStyle = '#333';
    var fontSize = size < 600 ? 10 : 12;
    ctx.font = 'bold ' + fontSize + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('买波', centerX, top - 10);
    ctx.fillText('卖波', centerX, bottom + 20);
    ctx.textAlign = 'left';
    ctx.fillText('偏空', left - 26, centerY + 3);
    ctx.textAlign = 'right';
    ctx.fillText('偏多', right + 26, centerY + 3);
    
    var labelFontSize = size < 600 ? 11 : 13;
    ctx.font = 'bold ' + labelFontSize + 'px Arial';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.fillText('偏空—买波', left + halfQuadrant / 2, top + 20);
    ctx.fillText('偏多—买波', centerX + halfQuadrant / 2, top + 20);
    ctx.fillText('偏空—卖波', left + halfQuadrant / 2, bottom - 12);
    ctx.fillText('偏多—卖波', centerX + halfQuadrant / 2, bottom - 12);
    
    var filteredRecords = canvasRecords.filter(function(r) {
        if (selectedQuadrants.includes('全部')) return true;
        
        var quadrant = r.quadrant || '';
        if (selectedQuadrants.includes(quadrant)) return true;
        
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
    
    var pointScale = size < 600 ? 0.85 : (size < 800 ? 0.80 : 0.75);
    var points = filteredRecords.map(function(record) {
        var xRange = record.direction_score >= 0 ? halfQuadrant : halfQuadrant;
        var yRange = record.vol_score >= 0 ? halfQuadrant : halfQuadrant;
        var x = centerX + (record.direction_score / 5) * xRange * pointScale;
        var y = centerY - (record.vol_score / 5) * yRange * pointScale;
        return { record: record, x: x, y: y };
    });
    
    var minDistance = size < 600 ? 40 : Math.max(45, size * 0.06);
    var maxIterations = 50;
    for (var iter = 0; iter < maxIterations; iter++) {
        var moved = false;
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
                    moved = true;
                }
            }
        }
        if (!moved) break;
    }
    
    var symbolFontSize = size < 600 ? 12 : 14;
    points.forEach(function(item) {
        var record = item.record;
        var x = item.x;
        var y = item.y;
        
        var color;
        var quadrant = record.quadrant || '';
        
        if (quadrant.includes('偏多') && quadrant.includes('买波')) {
            color = '#00C853'; // 偏多—买波
        } else if (quadrant.includes('偏多') && quadrant.includes('卖波')) {
            color = '#FF9500'; // 偏多—卖波
        } else if (quadrant.includes('偏空') && quadrant.includes('买波')) {
            color = '#34C759'; // 偏空—买波
        } else if (quadrant.includes('偏空') && quadrant.includes('卖波')) {
            color = '#007AFF'; // 偏空—卖波
        } else {
            color = '#9C27B0'; // 中性/待观察
        }
        
        ctx.fillStyle = color;
        ctx.font = 'bold ' + symbolFontSize + 'px "Comic Sans MS", cursive, sans-serif';
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
    
    var filteredRecords = canvasRecords.filter(function(r) {
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
        console.error('Load dates error:', e);
    }
}

window.addEventListener('resize', function() {
    if (canvas) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        drawQuadrant();
    }
});

document.addEventListener('click', function(e) {
    var filter = document.querySelector('.quadrant-filter');
    var dropdown = document.getElementById('quadrantDropdown');
    if (filter && !filter.contains(e.target)) {
        dropdown.classList.remove('open');
    }
});

window.onload = function() {
    loadRecords();
    loadDates();
    
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