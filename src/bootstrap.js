const {classes: Cc, interfaces: Ci, utils: Cu} = Components,
			VERSION = "1.0.1",
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
	VERSION: VERSION,
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
		num: {default: 15, value: 15, type: "number", min: 0, max: 999}, //number of items in list
		overflow: {default: OVERFLOW_SCROLL, value: OVERFLOW_SCROLL, type: "number", min: 0, max: 2}, //show scrollbars = 0 none, 1 = scrollbars, 2 = up/down buttons
		showIndex: {default: INDEX_NONE, value: INDEX_NONE, type: "number", min: 0, max: 2}, //show index number 0 = none, 1 = front, 2 = back
		showIndexTotal: {default: false, value: false, type: "boolean"}, //show number of total items in session history
		showItem: {default: SHOW_TITLE, value: SHOW_TITLE, type: "number", min: 0, max: 3}, //show items as: 0 = title, 1 = url, 2 = title on hover, 3 = url on hover
		tooltip: {default: TOOLTIP_NONE, value: TOOLTIP_NONE, type: "number", min: 0, max: 3}, //show website title and/or URL address in tooltip
		version: {default: VERSION, value: VERSION, type: "string"},
		showChangesLog: {default: true, value: true, type: "boolean"}, //show changes log after update
	},
	setDefaultPrefs: function(prefix)
	{
		let prefix = prefix || "",
				pr, name = "", domain = "";
		if (prefix)
		{
			pr = bfht.prefs[prefix];
			domain = prefix + ".";
		}
		else
		{
			pr = bfht.prefs;
		}
		let branch = Services.prefs.getDefaultBranch(PREF_BRANCH);
		for (let [key, val] in Iterator(pr))
		{
			name = domain + key;
			switch (val.type)
			{
				case "boolean":
						//make sure the setting is correct type
						if (branch.getPrefType(name) != Ci.nsIPrefBranch.PREF_BOOL)
							branch.deleteBranch(name);

						branch.setBoolPref(name, val.default);
						val.value = this.pref.getBoolPref(name);
					break;
				case "number":
						//make sure the setting is correct type
						if (branch.getPrefType(name) != Ci.nsIPrefBranch.PREF_INT)
							branch.deleteBranch(name);

						branch.setIntPref(name, val.default);
						val.value = this.pref.getIntPref(name);
						//make sure the setting is in allowed range
						if (val.value < val.min || (val.value > val.max && val.max != -1))
						{
							val.value = val.default;
							this.pref.setIntPref(name, val.value);
						}
					break;
				case "string":
						//make sure the setting is correct type
						if (branch.getPrefType(name) != Ci.nsIPrefBranch.PREF_STRING)
							branch.deleteBranch(name);

						branch.setCharPref(name, val.default);
						val.value = this.pref.getCharPref(name);
					break;
				case "object":
						this.setDefaultPrefs(key);
						continue;
					break;
			}
			if (prefix)
				this.prefs[prefix][key].value = val.value;
			else
				this.prefs[key].value = val.value;

		}
	},

	onPrefChange: {
		observe: function(pref, aTopic, key)
		{
			if(aTopic != "nsPref:changed")
				return;

			let val;

			switch (pref.getPrefType(key))
			{
				case Ci.nsIPrefBranch.PREF_BOOL:
						if (bfht.prefs[key].type != "boolean")
							return false;

						val = pref.getBoolPref(key);
					break;
				case Ci.nsIPrefBranch.PREF_INT:
						if (bfht.prefs[key].type != "number")
							return false;

						val = pref.getIntPref(key);
						if (val < bfht.prefs[key].min || (val > bfht.prefs[key].max && bfht.prefs[key].max != -1))
							pref.setIntPref(key, bfht.prefs[key].default);

					break;
				case Ci.nsIPrefBranch.PREF_STRING:
						if (bfht.prefs[key].type != "string")
							return false;

						val = pref.getCharPref(key);
					break;
				default:
					return;
			}
			changeObject(key + ".value", val, bfht.prefs);
		}
	},


	init: function(addon, reason)
	{
		this.setDefaultPrefs();
		watchWindows(function(window, type)
		{
			if (!window)
				return;

			type = type || null;
			var document = window.document,
					_FillHistoryMenu = null,
					menupopupClone = {},
					XULBrowserWindow = window.XULBrowserWindow,
					getWebNavigation = window.getWebNavigation,
					gNavigatorBundle = window.gNavigatorBundle,
					click_hold_context_menus = Services.prefs.getBranch('ui.click_hold_context_menus'),
					showChangesLog = function()
					{
						window.openUILinkIn(addon.getResourceURI("changes.txt").spec, "tab");
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
								if (Cc["@mozilla.org/xpcom/version-comparator;1"]
											.getService(Ci.nsIVersionComparator)
											.compare(Cc["@mozilla.org/xre/app-info;1"]
															.getService(Ci.nsIXULAppInfo).version, "7.0") > 0)
									return;

								var window = addonOptionsDisplayed.window,
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

								prefChanged.pref.QueryInterface(Ci.nsIPrefBranch2).addObserver(node.getAttribute("pref"), prefChanged, false);
								listen(window, window, "unload", function()
								{
									prefChanged.pref.QueryInterface(Ci.nsIPrefBranch2).removeObserver(node.getAttribute("pref"), prefChanged, false);
								}, false);

								unload(function()
								{
									prefChanged.pref.QueryInterface(Ci.nsIPrefBranch2).removeObserver(node.getAttribute("pref"), prefChanged, false);
								}, window);
								listen(window, node.firstChild, "command", function (e)
								{
									bfht.pref.setIntPref(key, e.target.value);
								});
							} //settingFix

							function settingInit(node, key)
							{
								if (node.getAttribute("type") == "menulist")
								{
									settingFix(node, key);
								}
								node.setAttribute("title", _("options." + key));
								if (_("options." + key + ".desc"))
									node.setAttribute("desc", _("options." + key + ".desc"));

								let i = 0;
								while(node = $(document, "bfht_" + key + "_" + i))
								{
									node.setAttribute(node.tagName == "label" ? "value" : "label", _("options." + key + "." + i));
									i++;
								}
							}
							for (let [key, val] in Iterator(bfht.prefs))
							{
								var node = $(document, "bfht_" + key);
								if (!node)
									continue;

								settingInit(node, key);
							}
							$(document, "bfht_showChangesLog_button").appendChild(document.createTextNode(_("options.showChangesLog.button")));
							$(document, "bfht_showChangesLog_button").className = "text-link";
							$(document, "bfht_showChangesLog_button").removeAttribute("value");
							listen(window, $(document, "bfht_showChangesLog_button"), "click", showChangesLog, false);
							$(document, "bfht_num").setAttribute("min", bfht.prefs.num.min);
							$(document, "bfht_num").setAttribute("max", bfht.prefs.num.max);

							//fixing text wrap and adding menulist setting for FF 7 - 9
							if (Cc["@mozilla.org/xpcom/version-comparator;1"]
										.getService(Ci.nsIVersionComparator)
										.compare(Cc["@mozilla.org/xre/app-info;1"]
														.getService(Ci.nsIXULAppInfo).version, "12") < 0)
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
											desc[0].lastChild.parentNode.removeChild(desc[0].lastChild);
										}
									}
								}}, 0, Ci.nsITimer.TYPE_ONE_SHOT);
								unload(timer.cancel, window);
							}
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

					menupopup.setAttribute("scrollbars", bfht.prefs.overflow.value == OVERFLOW_SCROLL);
					function menupopupReopen()
					{
						//work around for an issue, that doesn't scroll to correct item on first opening
						menupopup.openPopup();
						menupopup.hidePopup();
					}
					if (bfht.prefs.overflow.value == OVERFLOW_NONE)
					{
						//work around for an issue when buttons shown after switching from scrollbars mode
						bfht.prefs.overflow.value = OVERFLOW_BUTTONS;
						menupopupReopen();
						bfht.prefs.overflow.value = OVERFLOW_NONE;
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
				click_hold_context_menus.QueryInterface(Ci.nsIPrefBranch2).removeObserver('', onPrefChangeScroll);
				bfht.pref.QueryInterface(Ci.nsIPrefBranch2).removeObserver('', onPrefChangeScroll, false);
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
  var webNav = getWebNavigation();
  var sessionHistory = webNav.sessionHistory;

  var count = sessionHistory.count;
  if (count <= 1) // don't display the popup for a single item
    return false;

	// We use height of menu item to determine final height of popup, and we need add height of an empty popup to it, because it might have margin/padding
	var heightAdd = aParent.boxObject.height;
	var num = "", numBefore = "", numAfter = "", maxHeight = "", itemCurrent = null;
	const MAX_HISTORY_MENU_ITEMS = bfht.prefs.overflow.value != bfht.OVERFLOW_NONE || !bfht.prefs.num.value ? 999999 : bfht.prefs.num.value;
//  const MAX_HISTORY_MENU_ITEMS = 15;
  var index = sessionHistory.index;
  var half_length = Math.floor(MAX_HISTORY_MENU_ITEMS / 2);
  var start = Math.max(index - half_length, 0);
  var end = Math.min(start == 0 ? MAX_HISTORY_MENU_ITEMS : index + half_length  + (half_length*2 < MAX_HISTORY_MENU_ITEMS ? 1 : 0), count);
  if (end == count)
    start = Math.max(count - MAX_HISTORY_MENU_ITEMS, 0);

	var total = bfht.prefs.showIndex.value && bfht.prefs.showIndexTotal.value ? "/" + count : "";

  var tooltipBack = gNavigatorBundle.getString("tabHistory.goBack");
  var tooltipCurrent = gNavigatorBundle.getString("tabHistory.current");
  var tooltipForward = gNavigatorBundle.getString("tabHistory.goForward");

  for (var j = end - 1; j >= start; j--) {
    let item = document.createElement("menuitem");
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

		let tooltip;
    if (j < index) {
      item.className = "unified-nav-back menuitem-iconic menuitem-with-favicon";
//      item.setAttribute("tooltiptext", tooltipBack);
			tooltip = tooltipBack;
    } else if (j == index) {
      item.setAttribute("type", "radio");
      item.setAttribute("checked", "true");
      item.className = "unified-nav-current";
			tooltip = tooltipCurrent;
    } else {
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
  }

  let item = aParent.lastChild;
	if (bfht.prefs.num.value && end > bfht.prefs.num.value)
		aParent.style.maxHeight = item.boxObject.height * bfht.prefs.num.value + heightAdd + "px";
	else
		aParent.style.maxHeight = "";

	item = end - index + Math.floor(bfht.prefs.num.value > 1 ? bfht.prefs.num.value / 2 : 0) - 1;
	if (item > count-1)
		item = end-1;

	if (aParent.boxObject.firstChild)
		try{aParent.boxObject.firstChild.ensureElementIsVisible(aParent.children[item])}catch(e){};

  return true;
} //end FillHistoryMenu()

			// we need register bfht globaly in case another addon clones FillHistoryMenu function after we replaced with ours.
			window.bfht = bfht;
			var FillHistoryMenuTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer)
			FillHistoryMenuTimer.init({observe: function()
			{
				_FillHistoryMenu = window.FillHistoryMenu;
				window.FillHistoryMenu = FillHistoryMenu;
			}}, 500, Ci.nsITimer.TYPE_ONE_SHOT); //wait 0.5 sec for TMP finish patching FillHistoryMenu before we back it up and replace with ours
			unload(FillHistoryMenuTimer.cancel, window);

			if (type != "load" && reason != APP_STARTUP)
				overflowInit()

			Services.obs.addObserver(overflowInit, "browser-delayed-startup-finished", false);
			Services.obs.addObserver(addonOptionsDisplayed, "addon-options-displayed", false);
			click_hold_context_menus.QueryInterface(Ci.nsIPrefBranch2).addObserver('', onPrefChangeScroll, false);
			bfht.pref.QueryInterface(Ci.nsIPrefBranch2).addObserver('', onPrefChangeScroll, false);
			var version = bfht.pref.getCharPref("version");
			if (version != addon.version)
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
	unload();
}

function install(data)
{
}

function uninstall(data, reason)
{
	if (reason == ADDON_UNINSTALL)
		(function deletePrefs(prefix)
		{
			let prefix = prefix || "",
					pr, name = "", domain = "";
			if (prefix)
			{
				pr = bfht.prefs[prefix];
				domain = prefix + ".";
			}
			else
			{
				pr = bfht.prefs;
			}
			let branch = Services.prefs.getDefaultBranch(PREF_BRANCH);
			for (let [key, val] in Iterator(pr))
			{
				name = domain + key;
				if (val.type == "object")
					deletePrefs(key);
				else
					branch.deleteBranch(name);

			}
		})();
}