const {classes: Cc, interfaces: Ci, utils: Cu} = Components,
			PREF_BRANCH = "extensions.backforwardhistorytweaks.",
			OVERFLOW_NONE = 0,
			OVERFLOW_SCROLL = 1,
			OVERFLOW_BUTTONS = 2,
			INDEX_NONE = 0,
			INDEX_BEFORE = 1,
			INDEX_AFTER = 2,
			TOOLTIP_NONE = 0,
			TOOLTIP_NAME = 1,
			TOOLTIP_URL = 2,
			TOOLTIP_BOTH = 3,
			SHOW_TITLE = 0,
			SHOW_URL = 1,
			SHOW_TITLE_HOVER = 2,
			SHOW_URL_HOVER = 3;
var ADDON_ID;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

var addon = {
		getResourceURI: function(filePath) ({
			spec: __SCRIPT_URI_SPEC__ + "/../" + filePath
		})
	}, self = this;

var bfht = {
	//load our global constants as a work around for TabMixPlus compability
	PREF_BRANCH: PREF_BRANCH,
	ADDON_ID: ADDON_ID,
	OVERFLOW_NONE: OVERFLOW_NONE,
	OVERFLOW_SCROLL: OVERFLOW_SCROLL,
	OVERFLOW_BUTTONS: OVERFLOW_BUTTONS,
	INDEX_NONE: INDEX_NONE,
	INDEX_BEFORE: INDEX_BEFORE,
	INDEX_AFTER: INDEX_AFTER,
	TOOLTIP_NONE: TOOLTIP_NONE,
	TOOLTIP_NAME: TOOLTIP_NAME,
	TOOLTIP_URL: TOOLTIP_URL,
	TOOLTIP_BOTH: TOOLTIP_BOTH,
	SHOW_TITLE: SHOW_TITLE,
	SHOW_URL: SHOW_URL,
	SHOW_TITLE_HOVER: SHOW_TITLE_HOVER,
	SHOW_URL_HOVER: SHOW_URL_HOVER,

	pref: Services.prefs.getBranch(PREF_BRANCH),
	prefs: {
		num: {default: 15, value: 15, min: 0, max: 999}, //number of items in list
		overflow: {default: OVERFLOW_SCROLL, value: OVERFLOW_SCROLL, min: 0, max: 2}, //show scrollbars = 0 none, 1 = scrollbars, 2 = up/down buttons
		showIndex: {default: INDEX_NONE, value: INDEX_NONE, min: 0, max: 2}, //show index number 0 = none, 1 = front, 2 = back
		showIndexTotal: {default: false, value: false}, //show number of total items in session history
		showItem: {default: SHOW_TITLE, value: SHOW_TITLE, min: 0, max: 3}, //show items as: 0 = title, 1 = url, 2 = title on hover, 3 = url on hover
		tooltip: {default: TOOLTIP_NONE, value: TOOLTIP_NONE, min: 0, max: 3}, //show website title and/or URL address in tooltip
		order: {default: 1, value: 1, min: 0, max: 1}, //list order: 1 = newest (forward) on top, 0 = newest on bottom
//		combine: {default: true, value: true}, //combine back/forward into one list
		version: {default: "", value: ""},
		showChangesLog: {default: true, value: true}, //show changes log after update
	},
	browser_sessionhistory_max_entries: 50,
	setDefaultPrefs: function(reset)
	{
		let obj = bfht.prefs,
				name = "", domain = "",
				type, branch = Services.prefs.getDefaultBranch(PREF_BRANCH);
		for (let [key, val] in Iterator(obj))
		{
			name = domain + key;
			switch (typeof(val.default))
			{
				case "boolean":
						//make sure the setting is correct type
						type = branch.getPrefType(name);
						if (type != Ci.nsIPrefBranch.PREF_BOOL && type != Ci.nsIPrefBranch.PREF_INVALID)
							branch.deleteBranch(name);

						branch.setBoolPref(name, val.default);
						if (reset)
							bfht.pref.setBoolPref(name, val.default);

						val.value = bfht.pref.getBoolPref(name);
					break;
				case "number":
						//make sure the setting is correct type
						type = branch.getPrefType(name);
						if (type != Ci.nsIPrefBranch.PREF_INT && type != Ci.nsIPrefBranch.PREF_INVALID)
							branch.deleteBranch(name);

						branch.setIntPref(name, val.default);
						val.value = bfht.pref.getIntPref(name);
						if (name == "num")
						{
							let val2 = bfht.numCheck(val.value, bfht.prefs.num.value);
							if (val2 != val.value)
							{
								val.value = val2;
								bfht.pref.setIntPref(name, val2);
							}

						}

						//make sure the setting is in allowed range
						if (reset || ("min" in val && val.value < val.min) || ("max" in val && (val.max != -1 && val.value > val.max)))
						{
							val.value = val.default;
							bfht.pref.setIntPref(name, val.value);
						}
					break;
				case "string":
						//make sure the setting is correct type
						type = branch.getPrefType(name);
						if (type != Ci.nsIPrefBranch.PREF_STRING && type != Ci.nsIPrefBranch.PREF_INVALID)
							branch.deleteBranch(name);

						let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
						str.data = val.default;
						branch.setComplexValue(name, Ci.nsISupportsString, str);
						val.value = bfht.pref.getComplexValue(name, Ci.nsISupportsString).data;
						if (reset || ("regexp" in val && val.value.match(val.regexp)))
						{
							if (reset && name != "version")
								bfht.pref.setComplexValue(name, Ci.nsISupportsString, str);
						}
					break;
				default:
					continue;
			}
			obj[key].value = val.value;
		}
	},

	numCheck: function(val, prev)
	{
		val = Number(String(val).replace(/[^0-9]/g, ""));
		if (val > 0 && val < 3)
		{
			val = prev > val ? 0 : 3;
		}
		return val;
	},

	onPrefChange: {
		observe: function(pref, aTopic, key)
		{
			let val, obj = bfht.prefs;
			if(aTopic != "nsPref:changed" || typeof(obj[key]) == "undefined")
				return;

			obj = obj[key];
			switch (pref.getPrefType(key))
			{
				case Ci.nsIPrefBranch.PREF_BOOL:
						if (typeof(obj.default) != "boolean")
							return false;

						val = pref.getBoolPref(key);
					break;
				case Ci.nsIPrefBranch.PREF_INT:
						if (typeof(obj.default) != "number")
							return false;

						val = pref.getIntPref(key);
						if (("min" in obj && val < obj.min)
							|| ("max" in obj && (val > obj.max && obj.max != -1)))
							pref.setIntPref(key, obj.default);
						if (key == "num" && val < 3 && val > 0)
							val = 3;
					break;
				case Ci.nsIPrefBranch.PREF_STRING:
						if (typeof(obj.default) != "string")
							return false;

						val = pref.getComplexValue(key, Ci.nsISupportsString).data;
						if ("regexp" in obj && val.match(obj.regexp))
						{
							let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
							str.data = val = val == obj.value ? obj.default : obj.value;
							pref.setComplexValue(key, Ci.nsISupportsString, str);
						}
					break;
				default:
					return;
			}
			changeObject("value", val, obj);
		}
	},

	init: function(addon, reason)
	{
		this.setDefaultPrefs();
		bfht.browser_sessionhistory_max_entries = Services.prefs.getBranch("browser.sessionhistory.").getIntPref("max_entries");
		unload(function()
		{
			if (bfht.browser_sessionhistory_max_entries == 999998)
				bfht.browser_sessionhistory_max_entries = 50;

			Services.prefs.getBranch("browser.sessionhistory.").setIntPref("max_entries", bfht.browser_sessionhistory_max_entries);
		});
		Services.prefs.getBranch("browser.sessionhistory.").setIntPref("max_entries", 999998);
		watchWindows(function(window, type)
		{
			if (!window)
				return;

			type = type || null;
			// we need register bfht globaly in case another addon clones FillHistoryMenu function after we replaced with ours.
			window.bfht = bfht;
			var document = window.document,
					_FillHistoryMenu = null,
					menupopupClone = {},
					XULBrowserWindow = window.XULBrowserWindow,
					getWebNavigation = window.getWebNavigation,
					gNavigatorBundle = window.gNavigatorBundle,
					gBrowser = window.gBrowser,
					click_hold_context_menus = Services.prefs.getBranch('ui.click_hold_context_menus'),
					showChangesLog = function()
					{
						let url = Services.vc.compare(Services.appinfo.version, "7.0") > 0
											? "chrome://bfht/content/changes.xul"
											: addon.getResourceURI("changes.txt").spec;
						window.switchToTabHavingURI(url, true);
					},
					onPrefChangeScroll = {
						window: window,
						document: document,
						overflowInit: overflowInit,
						observe: function(pref, aTopic, key)
						{
							if(aTopic != "nsPref:changed")
								return;

							bfht.onPrefChange.observe(pref, aTopic, key);
							var window = onPrefChangeScroll.window;
							var document = onPrefChangeScroll.document;
							onPrefChangeScroll.overflowInit();
						}
					},
					addonOptionsDisplayed = {
						window: window,
						observe: function(document, aTopic, aData)
						{
						if (aTopic != "addon-options-displayed" || aData != ADDON_ID)
								return;

							function settingFix(node, key)
							{
								//add menulist support for FF 7
								if (Services.vc.compare(Services.appinfo.version, "7.0") > 0)
									return;

								let window = addonOptionsDisplayed.window,
										prefChanged = {
											pref: Services.prefs.getBranch(""),
											observe: function(pref, aTopic, key)
											{
												if(aTopic != "nsPref:changed")
													return;

												node.firstChild.selectedIndex = pref.getIntPref(key);
											},
										};
								node.setAttribute("type", "control");
								node.firstChild.value = bfht.prefs[key].value;
								let addObserver = prefChanged.pref.addObserver || prefChanged.pref.QueryInterface(Ci.nsIPrefBranch2).addObserver;
								addObserver(node.getAttribute("pref"), prefChanged, false);
								listen(window, window, "unload", function()
								{
									let removeObserver = prefChanged.pref.removeObserver || prefChanged.pref.QueryInterface(Ci.nsIPrefBranch2).removeObserver;
									removeObserver(node.getAttribute("pref"), prefChanged, false);
								}, false);

								unload(function()
								{
									let removeObserver = prefChanged.pref.removeObserver || prefChanged.pref.QueryInterface(Ci.nsIPrefBranch2).removeObserver;
									removeObserver(node.getAttribute("pref"), prefChanged, false);
								}, window);
								listen(window, node.firstChild, "command", function (e)
								{
									bfht.pref.setIntPref(key, e.target.value);
								});
							} //settingFix

							function settingInit(node, key)
							{
								switch(node.getAttribute("type"))
								{
									case "menulist":
											settingFix(node, key);
										break;
									case "integer":
									case "string":
											try
											{
												let attr = ["size", "flex"],
														n = node.boxObject.lastChild.firstChild;
												for (let [key, a] in Iterator(attr))
													if (node.hasAttribute(a))
														n.setAttribute(a, node.getAttribute(a));
											}
											catch(e){};
										break;
								}
								node.setAttribute("title", _("options." + key));
								if (_("options." + key + ".desc"))
									node.setAttribute("desc", _("options." + key + ".desc"));

								let i = 0;
								while(node = $(document, "bfht_" + key + "_" + i))
								{
									node.setAttribute(node.tagName == "label" ? "value" : "label", _("options." + key + "." + i));
									node.setAttribute("default", i == bfht.prefs[key].default);
									i++;
								}
							} //settingInit

							for (let [key, val] in Iterator(bfht.prefs))
							{
								var node = $(document, "bfht_" + key);
								if (!node)
									continue;

								settingInit(node, key);
							}
							$(document, "bfht_reset_button").appendChild(document.createTextNode(_("options.reset")));
							$(document, "bfht_reset_button").removeAttribute("value");
							listen(window, $(document, "bfht_reset_button"), "click", bfht.setDefaultPrefs, false);
							listen(window, $(document, "bfht_showChangesLog"), "click", function(e)
							{
								if (e.originalTarget.tagName == "xul:label" && e.originalTarget.className == "preferences-title")
									showChangesLog();
							}, false);
							$(document, "bfht_num").setAttribute("min", bfht.prefs.num.min);
							$(document, "bfht_num").setAttribute("max", bfht.prefs.num.max);
							//a hack to allow use text in the numberbox
							$(document, "bfht_num").prev = [0, 0, bfht.prefs.num.value];
							var numBox = $(document, "bfht_num");
							function replace_validateValue(numBox)
							{
								numBox._validateValue = function(aValue, aIsIncDec)
								{
									var obj = $(document, "bfht_num");
									aValue = Number(String(aValue).replace(/[^0-9\-]/g, "")) || 0;
									var min = numBox.min;
									var max = numBox.max;
									if (aValue < min)
										aValue = min;
									else if (aValue > max)
										aValue = numBox._value > max ? max : numBox._value;
									aValue = "" + aValue;
									numBox._valueEntered = false;
									numBox._value = Number(aValue);
									obj.prev.push(numBox._value);
									obj.prev.splice(0,1);
									numBox.inputField.value = Number(aValue) ? aValue : _("all");
									numBox._enableDisableButtons();
									return aValue;
								}
							}
							//fixing text wrap and adding menulist setting for FF 7 - 9
							if (Services.vc.compare(Services.appinfo.version, "12") < 0)
							{
								//fixing text wrap
								//for some reason on FF10 and older setting.boxObject.firstChild is null at this point. We need wait until it's available.
								var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer)
								timer.init({observe: function()
								{
									for (let [key, val] in Iterator(bfht.prefs))
									{
										let node = $(document, "bfht_" + key);
										if (!node || !node.boxObject.firstChild)
											continue;

										node = node.boxObject.firstChild;
										let desc = node.getElementsByClassName("preferences-description"),
												title = node.getElementsByClassName("preferences-title");

										if (title.length)
										{
											title[0].removeAttribute("crop");
											title[0].appendChild(document.createTextNode(title[0].value));
											title[0].setAttribute("text", title[0].value);
											title[0].removeAttribute("value");
											title[0].style.whiteSpace = "pre-wrap";
										}

										if (desc.length && desc[0].value)
										{
											desc[0].removeAttribute("crop");
											desc[0].firstChild.nodeValue = desc[0].value;
											desc[0].setAttribute("text", desc[0].value);
											desc[0].removeAttribute("value");
											desc[0].style.whiteSpace = "pre-wrap";
//											desc[0].lastChild.parentNode.removeChild(desc[0].lastChild);
										}
									}
									numBox = $(document, "bfht_num").boxObject.lastChild.firstChild;
									replace_validateValue(numBox);
									$(document, "bfht_num").value = bfht.prefs.num.value;
									listen(window, $(document, "bfht_num"), "change", function(e)
									{
										e.target.value = bfht.numCheck(e.target.value, e.target.prev[0]);
										e.target.boxObject.lastChild.boxObject.firstChild.select();
									}, true);
									$(document, "bfht_showChangesLog").appendChild($(document, "bfht_showChangesLog_button"));
									node = $(document, "bfht_reset").boxObject.firstChild.getElementsByClassName("preferences-title");
									if (node.length)
										node[0].insertBefore($(document, "bfht_reset_button"), node[0].firstChild);

								}}, 0, Ci.nsITimer.TYPE_ONE_SHOT);
								unload(timer.cancel, window);
							}
							else
							{
								var desc = $(document, "bfht_showChangesLog").boxObject.firstChild.getElementsByClassName("preferences-description");
								if (desc.length)
								{
									let l = document.createElement("label");
									l.appendChild(desc[0].firstChild);
									l.appendChild($(document, "bfht_showChangesLog_button"));
									desc[0].appendChild(l);
								}
								var desc = $(document, "bfht_reset").boxObject.firstChild.getElementsByClassName("preferences-alignment");
								if (desc.length)
								{
									let l = document.createElement("label");
									l.appendChild(desc[0].firstChild);
									l.appendChild($(document, "bfht_reset_button"));
									desc[0].appendChild(l);
								}
								numBox = $(document, "bfht_num").input;
								replace_validateValue(numBox);
								$(document, "bfht_num").value = bfht.prefs.num.value;
								listen(window, $(document, "bfht_num"), "change", function(e)
								{
									e.target.value = bfht.numCheck(e.target.value, e.target.prev[0]);
									e.target.input.select();
								}, true);
							}
							// FF 10+ display information about addons taken from the web,
							// that information is way too big to fit on the screen,
							// so we restrict it to scrollbox where user don't need scroll much to get to the options.
							if (Services.vc.compare(Services.appinfo.version, "10") > 0)
							{
								let timer2 = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
								function changeNode(obj, name, value, force)
								{
									if (!("nodeBackupData" in obj))
									{
										obj.nodeBackupData = {};
										obj.nodeOrigData = {};
									}

									if (!(name in obj.nodeOrigData) || force)
									{
										if (!(name in obj.nodeOrigData))
										{
											obj.nodeOrigData[name] = obj.style[name];
										}
										obj.nodeBackupData[name] = obj.style[name];
									}
									obj.style[name] = value;
								} //changeNode

								function restoreNode(obj, name, value)
								{
									if ("nodeBackupData" in obj && name in obj.nodeBackupData)
										value = obj.nodeBackupData[name];
									else if (typeof(value) == "undefined")
										value = obj.style[name];

									changeNode(obj, name, value, 1);
								} //restoreNode

								function showDesc(obj)
								{
									let node = $(document, "detail-fulldesc").parentNode,
											c = $(document, "detail-view").getElementsByClassName("detail-view-container");
									if (obj.getAttribute("state") == "collapsed")
									{
										changeNode(node, "height", "10em");
										changeNode(node, "overflow", "auto");
										$(document, "detail-fulldesc").setAttribute("full", false);
									}
									else
									{
										changeNode(node, "maxHeight", "");
										changeNode(node, "height", "");
										changeNode(node, "overflow", "");
										$(document, "detail-fulldesc").setAttribute("full", true);
									}
								} //showDesc

								if (!$(document, "detail-fulldesc-splitter"))
								{
									$(document, "detail-fulldesc").setAttribute("persist", "full");
									timer2.init({observe: function()
									{
										let parent = $(document, "detail-desc").parentNode;
										if (parent.boxObject.height < 100)
											return;

										let vbox = document.createElement("vbox");
										let splitterBox = document.createElement("vbox");
										let splitter = document.createElement("splitter");
										let grippy = document.createElement("grippy");
										splitter.appendChild(grippy);
										splitterBox.appendChild(splitter);
										splitter.setAttribute("collapse", "before");
										splitter.setAttribute("state", $(document, "detail-fulldesc").getAttribute("full") == "true" ? "open" : "collapsed");
										splitter.setAttribute("resizebefore", "closest");
										splitter.setAttribute("resizeafter", "grow");
										splitter.id = "detail-fulldesc-splitter";
										splitter.style.cursor = "pointer";
										parent.appendChild(vbox);
										vbox.appendChild($(document, "detail-fulldesc"));
										parent.appendChild(splitterBox);

										showDesc(splitter);
										listen(window, grippy, "command", function(e){showDesc(e.target.parentNode)}, true);
										listen(window, splitter, "click", function(e){if (e.originalTarget == splitter) grippy.click();}, false);
										unload(function()
										{
											//we don't want remove persistant settings on browser shutdown
											if (bfht.reason == APP_SHUTDOWN)
												return;

											splitter.setAttribute("state", "open");
											showDesc(splitter);
											splitterBox.parentNode.removeChild(splitterBox);
											parent.appendChild($(document, "detail-fulldesc"));
											parent.removeChild(vbox);
											$(document, "detail-fulldesc").removeAttribute("full");
											$(document, "detail-fulldesc").removeAttribute("persist");
										}, window);
									}}, 0, Ci.nsITimer.TYPE_ONE_SHOT);
									unload(timer2.cancel, window);
								} //detail-fulldesc-splitter
							} //FF10+
						} //end addonOptionsDisplayed.observe()
					}; //end addonOptionsDisplayed

			function overflowInit()
			{
				function fixPopup(id)
				{
					var menupopup = $(document, id);
					if (menupopup.tagName != "menupopup")
						menupopup = menupopup.firstChild;

					if (!menupopup || menupopup.tagName != "menupopup")
						return;

					if (!menupopup.origNode)
					{
						menupopup.origNode = menupopup.cloneNode(true);

						if (!menupopup.hasStatusListener2) {
							// Show history item's uri in the status bar when hovering, and clear on exit
							listen(window, menupopup, "DOMMenuItemActive", function(aEvent)
							{
								if (bfht.prefs.showItem.value == SHOW_TITLE_HOVER || bfht.prefs.showItem.value == SHOW_URL_HOVER)
									aEvent.target.setAttribute("label", aEvent.target._label2);

								// Only the current page should have the checked attribute, so skip it
								if (!aEvent.target.hasAttribute("checked"))
									XULBrowserWindow.setOverLink(aEvent.target.getAttribute("uri"));
							}, false);
							listen(window, menupopup, "DOMMenuItemInactive", function(aEvent)
							{
								if (bfht.prefs.showItem.value == SHOW_TITLE_HOVER || bfht.prefs.showItem.value == SHOW_URL_HOVER)
									aEvent.target.setAttribute("label", aEvent.target._label);

								XULBrowserWindow.setOverLink("");
							}
							, false);
							menupopup.hasStatusListener2 = true;
						}

						unload(function()
						{
							menupopup.parentNode.replaceChild(menupopup.origNode, menupopup);
						}, window);
					}

					//work around for an issue, that doesn't scroll to correct item on first opening
					function menupopupReopen()
					{
						menupopup.openPopup();
						menupopup.hidePopup();
					}
					if (bfht.prefs.overflow.value != OVERFLOW_SCROLL)
					{
						//work around for an issue when buttons shown after switching from scrollbars mode
						let n = bfht.prefs.num.value;
						let o = bfht.prefs.overflow.value;
						bfht.prefs.num.value = 1;
						bfht.prefs.overflow.value = OVERFLOW_BUTTONS;
						menupopupReopen();
						bfht.prefs.num.value = n;
						bfht.prefs.overflow.value = o;
					}
					else
					{
						menupopupReopen()
					}
				}
				fixPopup("backForwardMenu");
				fixPopup("back-button");
				fixPopup("forward-button");
			} //end overflowInit()

			function cleanup()
			{
				//restore original function
				delete window.bfht;
				window.FillHistoryMenu = _FillHistoryMenu;
				let removeObserver = click_hold_context_menus.removeObserver || click_hold_context_menus.QueryInterface(Ci.nsIPrefBranch2).removeObserver;
				removeObserver('', onPrefChangeScroll);
				removeObserver = bfht.pref.removeObserver || bfht.pref.QueryInterface(Ci.nsIPrefBranch2).removeObserver;
				removeObserver('', onPrefChangeScroll, false);
				Services.obs.removeObserver(overflowInit, "browser-delayed-startup-finished");
				Services.obs.removeObserver(addonOptionsDisplayed, "addon-options-displayed");
			}

//modified FillHistoryMenu function from chrome://browser/content/browser.js
function FillHistoryMenu(aParent) {
/*
  // Lazily add the hover listeners on first showing and never remove them
  if (!aParent.hasStatusListener) {
    // Show history item's uri in the status bar when hovering, and clear on exit
    aParent.addEventListener("DOMMenuItemActive", function(aEvent) {
      // Only the current page should have the checked attribute, so skip it
      if (!aEvent.target.hasAttribute("checked"))
        XULBrowserWindow.setOverLink(aEvent.target.getAttribute("uri"));
    }, false);
    aParent.addEventListener("DOMMenuItemInactive", function() {
      XULBrowserWindow.setOverLink("");
    }, false);

    aParent.hasStatusListener = true;
  }
*/
	//to calculate proper height, we must reset the view of the popup to default
	aParent.removeAttribute("scrollbars");
	aParent.style.maxHeight = "";

	//TMP compatibility replaced all entry.title with tablib.menuItemTitle(entry)
	function TMP_compat(e)
	{
		return "tablib" in window && "menuItemTitle" in window.tablib ? window.tablib.menuItemTitle(e) : e.title;
	}
  // Remove old entries if any
  var children = aParent.childNodes;
  for (var i = children.length - 1; i >= 0; --i) {
    if (children[i].hasAttribute("index"))
      aParent.removeChild(children[i]);
  }
  var webNav = gBrowser.webNavigation;//getWebNavigation();
  var sessionHistory = webNav.sessionHistory;

  var count = sessionHistory.count;
  if (count <= 1) // don't display the popup for a single item
    return false;

	let num = "",
			numBefore = "",
			numAfter = "",
			total = bfht.prefs.showIndex.value && bfht.prefs.showIndexTotal.value ? "/" + count : "",
			j,
			maxHeight = 0,
			n = 0,
			combine = true,//bfht.prefs.combine.value,
			// maybe one day we'll add separate menu for back and forward buttons 
			backButton = aParent.parentNode.id == "back-button" || (aParent.triggerNode && aParent.triggerNode.id == "back-button");
	const MAX_HISTORY_MENU_ITEMS = bfht.prefs.overflow.value != bfht.OVERFLOW_NONE || !bfht.prefs.num.value ? 999999 : bfht.prefs.num.value;
//  const MAX_HISTORY_MENU_ITEMS = 15;
  var index = sessionHistory.index;
  var half_length = Math.floor(MAX_HISTORY_MENU_ITEMS / 2);
  var start = Math.max(index - half_length, 0);
  var end = Math.min(start == 0 ? MAX_HISTORY_MENU_ITEMS : index + half_length  + (half_length*2 < MAX_HISTORY_MENU_ITEMS ? 1 : 0), count);
  if (end == count)
    start = Math.max(count - MAX_HISTORY_MENU_ITEMS, 0);
  var tooltipBack = gNavigatorBundle.getString("tabHistory.goBack");
  var tooltipCurrent = gNavigatorBundle.getString("tabHistory.current");
  var tooltipForward = gNavigatorBundle.getString("tabHistory.goForward");

	if (bfht.prefs.order.value)
	{
		j = end - 1;
	}
	else
	{
		let startBackup = start;
		start = end;
		end = startBackup;
		j = end;
	}
	do
	{
		let item = document.createElement("menuitem");
		let tooltip;
    let entry = sessionHistory.getEntryAtIndex(j, false);
    let uri = entry.URI.spec;

    item.setAttribute("uri", uri);
//    item.setAttribute("label", entry.title || uri);
    item.setAttribute("index", j);

    if (j != index) {
      try {
        let iconURL = Cc["@mozilla.org/browser/favicon-service;1"]
                         .getService(Ci.nsIFaviconService)
                         .getFaviconForPage(entry.URI).spec;
        item.style.listStyleImage = "url(" + iconURL + ")";
      } catch (ex)
      {
      	try
      	{
					let iconURL = Cc["@mozilla.org/browser/favicon-service;1"]
						.getService(Ci.nsIFaviconService)
						.QueryInterface(Ci.mozIAsyncFavicons);
		      iconURL.getFaviconURLForPage(entry.URI, function (aURI) {
		        if (aURI) {
		          iconURL = iconURL.getFaviconLinkForIcon(aURI).spec;
		          item.style.listStyleImage = "url(" + iconURL + ")";
		        }
		      });
      	}
      	catch(e){}
      }
    }

    if (j < index) {
    	if (!backButton && !combine)
    		continue;

      item.className = "unified-nav-back menuitem-iconic menuitem-with-favicon";
//      item.setAttribute("tooltiptext", tooltipBack);
			tooltip = tooltipBack;
    } else if (j == index) {
      item.setAttribute("type", "radio");
      item.setAttribute("checked", "true");
      item.className = "unified-nav-current";
			tooltip = tooltipCurrent;
			aParent.selectedItem = item;
			aParent.selectedIndex = index;
    } else {
    	if (backButton && !combine)
    		continue;
      item.className = "unified-nav-forward menuitem-iconic menuitem-with-favicon";
//      item.setAttribute("tooltiptext", tooltipForward);
			tooltip = tooltipForward;
    }

		if (bfht.prefs.showIndex.value)
		{
			num = count - (count - j) + 1;
			switch (bfht.prefs.showIndex.value)
			{
				case bfht.INDEX_BEFORE:
						numBefore = "[" + num + total +"] ";
					break;
				case bfht.INDEX_AFTER:
						numAfter = " [" + num + total + "]";
					break;
				default:
			}
		}
		switch (bfht.prefs.showItem.value)
		{
			case bfht.SHOW_TITLE:
			case bfht.SHOW_TITLE_HOVER:
					item._label = TMP_compat(entry) || uri;
					item._label2 = uri;
				break;
			case bfht.SHOW_URL:
			case bfht.SHOW_URL_HOVER:
					item._label = uri;
					item._label2 = TMP_compat(entry) || uri;
				break;
		}
		item._label = numBefore + item._label + numAfter;
		item._label2 = numBefore + item._label2 + numAfter;
		item.setAttribute("label", item._label);
		item.setAttribute("crop", "none");
		let tt = tooltip;
		switch (bfht.prefs.tooltip.value)
		{
			case bfht.TOOLTIP_URL:
					tt = uri;
				break;
			case bfht.TOOLTIP_NAME:
					tt = TMP_compat(entry) || uri;
				break;
			case bfht.TOOLTIP_BOTH:
					tt = (TMP_compat(entry) || tooltip) + "\n(" + uri + ")";
				break;
		}
		item.setAttribute("tooltiptext", tt);
		aParent.appendChild(item);
		if (++n <= bfht.prefs.num.value - (bfht.prefs.overflow.value == OVERFLOW_SCROLL ? 1 : 0))
			maxHeight = aParent.boxObject.height;
  }
	while(bfht.prefs.order.value ? --j >= start : ++j < start);

	if (bfht.prefs.overflow.value == OVERFLOW_SCROLL)
		aParent.setAttribute("scrollbars", true);
	else
		aParent.removeAttribute("scrollbars");

	if (bfht.prefs.num.value && count > bfht.prefs.num.value)
		aParent.style.maxHeight = (maxHeight + (bfht.prefs.overflow.value == OVERFLOW_SCROLL ? 2 : 0)) + "px";
	else
		aParent.style.maxHeight = "";

	let item = (bfht.prefs.order.value ? end - index - 1 : index) + Math.floor(bfht.prefs.num.value > 1 ? bfht.prefs.num.value / 2 : 0);

	if (item > count - 1)
		item = (bfht.prefs.order.value ? end : start) - 1;

	if (aParent.boxObject.firstChild)
		try{aParent.boxObject.firstChild.ensureElementIsVisible(aParent.children[item])}catch(e){};

  return true;
} //end FillHistoryMenu()

			let func = function()
			{
				if (FillHistoryMenu != window.FillHistoryMenu)
				{
					_FillHistoryMenu = window.FillHistoryMenu;
					window.FillHistoryMenu = FillHistoryMenu;
				}
				if (FillHistoryMenuTimer.type == Ci.nsITimer.TYPE_ONE_SHOT)
				{
					overflowInit()
					FillHistoryMenuTimer.init({observe: func}, 10000, Ci.nsITimer.TYPE_REPEATING_SLACK);
				}
			}
			let FillHistoryMenuTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
			FillHistoryMenuTimer.init({observe: func}, 500, Ci.nsITimer.TYPE_ONE_SHOT); //wait 0.5 sec for TMP finish patching FillHistoryMenu before we back it up and replace with ours and then as a precation repeat the check every 10 seconds;
			unload(FillHistoryMenuTimer.cancel, window);

			if (type != "load" && reason != APP_STARTUP)
				overflowInit()

			Services.obs.addObserver(overflowInit, "browser-delayed-startup-finished", false);
			Services.obs.addObserver(addonOptionsDisplayed, "addon-options-displayed", false);
			let addObserver = click_hold_context_menus.addObserver || click_hold_context_menus.QueryInterface(Ci.nsIPrefBranch2).addObserver;
			addObserver('', onPrefChangeScroll, false);
			addObserver = bfht.pref.addObserver || bfht.pref.QueryInterface(Ci.nsIPrefBranch2).addObserver;
			addObserver('', onPrefChangeScroll, false);
			if (bfht.prefs.version.value != addon.version)
			{
				bfht.pref.setCharPref("version", addon.version);
				if (bfht.pref.getBoolPref("showChangesLog"))
				{
					var changesLogTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer)
					changesLogTimer.init({observe: function()
					{
						showChangesLog();
					}}, 0, changesLogTimer.TYPE_ONE_SHOT);
					unload(changesLogTimer.cancel, window);
				}
			}
			listen(window, window, "unload", cleanup, false);
			unload(cleanup, window);
		}, "navigator:browser"); //end watchWindows
	}, //end bfht.init()
} //end bfht

function include(path)
{
	Services.scriptloader.loadSubScript(addon.getResourceURI(path).spec, self);
}

function $(node, childId)
{
	if (node.getElementById)
		return node.getElementById(childId);
	else
		return node.querySelector("#" + childId);
}

function startup(data, reason)
{
	bfht.data = data;
	bfht.reason = reason;
	if (Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0)
		try{Components.manager.addBootstrappedManifestLocation(data.installPath)}catch(e){}

	ADDON_ID = data.id;
	include("includes/utils.js");
	include("includes/l10n.js");
	l10n(addon, "backforwardhistorytweaks.properties");
	unload(l10n.unload);
	loadStyles(addon, ["style"]);
	AddonManager.getAddonByID(ADDON_ID, function(addon)
	{
		bfht.init(addon, reason);
	});
}

function shutdown(data, reason)
{
	bfht.data = data;
	bfht.reason = reason;
	unload();
	if (Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0)
		try{Components.manager.removeBootstrappedManifestLocation(data.installPath)}catch(e){}
}

function install(data, reason)
{
	bfht.data = data;
	bfht.reason = reason;
}

function uninstall(data, reason)
{
	bfht.data = data;
	bfht.reason = reason;
	if (reason == ADDON_UNINSTALL)
		Services.prefs.getDefaultBranch(PREF_BRANCH).deleteBranch('');
}