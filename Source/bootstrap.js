var   {classes: Cc, interfaces: Ci, utils: Cu} = Components,
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
			SHOW_URL_HOVER = 3,
			CHANGESLOG_NONE = 0,
			CHANGESLOG_NOTIFICATION = 1,
			CHANGESLOG_NOTIFICATION2 = 2,
			CHANGESLOG_FULL = 4,
			RIGHTCLICK_NONE = 0,
			RIGHTCLICK_MENU = 1,
			RIGHTCLICK_COPY = 2,
			FORWARD_BUTTON = 1,
			BACK_BUTTON = 2;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
try{XPCOMUtils.defineLazyModuleGetter(this, "Services", "resource://gre/modules/Services.jsm")}catch(e){};
try{XPCOMUtils.defineLazyModuleGetter(this, "AddonManager", "resource://gre/modules/AddonManager.jsm")}catch(e){};
try{XPCOMUtils.defineLazyModuleGetter(this, "BrowserUtils", "resource://gre/modules/BrowserUtils.jsm")}catch(e){};
try{XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils", "resource://gre/modules/PlacesUtils.jsm")}catch(e){};
try{XPCOMUtils.defineLazyModuleGetter(this, "SessionStore", "resource:///modules/sessionstore/SessionStore.jsm")}catch(e){};

function include(path)
{
	Services.scriptloader.loadSubScript(addon.getResourceURI(path).spec, self);
}

var log = console.log;
var ADDON_ID,
	addon = {},
	self = this,
	bfht = {
	//load our global constants as a work around for TabMixPlus compability
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
	FORWARD_BUTTON: FORWARD_BUTTON,
	BACK_BUTTON: BACK_BUTTON,
	PREF_BRANCH: null,
	pref: null,
	prefs: {
		num: {default: 15, value: 15, min: 0, max: 999}, //number of items in list
		overflow: {default: OVERFLOW_SCROLL, value: OVERFLOW_SCROLL, min: 0, max: 2}, //show scrollbars = 0 none, 1 = scrollbars, 2 = up/down buttons
		showIndex: {default: INDEX_NONE, value: INDEX_NONE, min: 0, max: 2}, //show index number 0 = none, 1 = front, 2 = back
		showIndexTotal: {default: false, value: false}, //show number of total items in session history
		showItem: {default: SHOW_TITLE, value: SHOW_TITLE, min: 0, max: 3}, //show items as: 0 = title, 1 = url, 2 = title on hover, 3 = url on hover
		tooltip: {default: TOOLTIP_NONE, value: TOOLTIP_NONE, min: 0, max: 3}, //show website title and/or URL address in tooltip
		order: {default: 1, value: 1, min: 0, max: 1}, //list order: 1 = newest (forward) on top, 0 = newest on bottom
		version: {default: "install", value: ""},
//		versionPrev: {default: "install", value: ""},
		rightClick: {default: RIGHTCLICK_MENU, value: RIGHTCLICK_MENU, min:0, max: 3}, //right click on menu item
		curFavIcon: {default: true, value: true}, //show fav icon for current website
		combined: {default: true, value: true}, //combine history list for back and forward buttons into one
		alltabssort: {default: 0, value: 0, min: 0, max: 7}, //sort all tabs list, bitwise: 1 = by name, 2 = by domain
		showChangesLog: {default: CHANGESLOG_NOTIFICATION, value: CHANGESLOG_NOTIFICATION, min:0, max: 7}, //show changes log after update
	},
	browser_sessionhistory_max_entries: 50,
	max_serialize_back: null,
	notification: Cc['@mozilla.org/alerts-service;1'].getService(Ci.nsIAlertsService),
	notificationAvailable: true,
	prevVersion: null,
	popups: 0,
	prefString: function(pref, key, val)
	{
		let r, er = [];
		if (typeof(val) == "undefined")
		{
			try
			{
				r = pref.getComplexValue(key, Ci.nsISupportsString).data;
			}
			catch(e)
			{
				er.push(e);
				try
				{
					r = pref.getStringPref(key);
				}
				catch(e)
				{
					er.push(e);
					try
					{
						r = pref.getComplexValue(key, Ci.nsIPrefLocalizedString).data;
					}
					catch(e)
					{
						er.push(e);
						try
						{
							r = pref.getCharPref(key);
						}
						catch(e)
						{
							er.push(e);
							log(er);
						}
					}
				}
			}
		}
		else
		{
			try
			{
				let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
				str.data = val;
				r = pref.setComplexValue(key, Ci.nsISupportsString, str);
			}
			catch(e)
			{
				er.push(e);
				try
				{
					r = pref.setStringPref(key,val);
				}
				catch(e)
				{
					er.push(e);
					try
					{
						let str = Cc["@mozilla.org/pref-localizedstring;1"].createInstance(Ci.nsIPrefLocalizedString);
						str.data = val;
						r = pref.setComplexValue(key, Ci.nsIPrefLocalizedString, str);
					}
					catch(e)
					{
						er.push(e);
						try
						{
							r = pref.setCharPref(key, val);
						}
						catch(e)
						{
							er.push(e);
							log(er);
						}
					}
				}
			}
		}
		return r;
	},//prefString()

	setDefaultPrefs: function(reset)
	{
		let obj = bfht.prefs,
				name = "", domain = "",
				type, branch = Services.prefs.getDefaultBranch(PREF_BRANCH);
		for (let key in obj)
		{
			let val = obj[key];
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
							if (key == "showChangesLog" && !bfht.notificationAvailable)
								val.value = CHANGESLOG_FULL;

							bfht.pref.setIntPref(name, val.value);
						}
					break;
				case "string":
						//make sure the setting is correct type
						type = branch.getPrefType(name);
						if (type != Ci.nsIPrefBranch.PREF_STRING && type != Ci.nsIPrefBranch.PREF_INVALID)
							branch.deleteBranch(name);

						bfht.prefString(branch, name, val.default);
						val.value = bfht.prefString(bfht.pref, name);
						if (reset || ("regexp" in val && val.value.match(val.regexp)))
						{
							if (reset && name != "version")
								bfht.prefString(bfht.pref, name, val.default);
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

	getPrefs: function(type)
	{
		let l = this.pref.getChildList(""),
				r = {};
		l.sort();
		for (let i of l)
		{
			switch(this.pref.getPrefType(i))
			{
				case Ci.nsIPrefBranch.PREF_BOOL:
					r[i] = this.pref.getBoolPref(i);
					break;
				case Ci.nsIPrefBranch.PREF_INT:
					r[i] = this.pref.getIntPref(i);
					break;
				case Ci.nsIPrefBranch.PREF_STRING:
					
					r[i] = this.prefString(this.pref, i);
					break;
			}
		}
		if (type)
			return r;
		else
		{
			l = [];
			for (let i in r)
				l.push(i + ": " + r[i]);

			return l.join("\n");
		}
	},

	fixUrl: function(url)
	{
		let tags = {
					OS: escape(Services.appinfo.OS + " (" + Services.appinfo.XPCOMABI + ")"),
					VER: escape(addon.version),
					APP: escape(Services.appinfo.name + " " + Services.appinfo.version),
					EMAIL: escape(this.decode(EMAIL)),
					NAME: escape(addon.name),
					EMAILRAW: this.decode(EMAIL),
					NAMERAW: addon.name,
					LOCALE: encodeURIComponent(Cc["@mozilla.org/chrome/chrome-registry;1"].getService(Ci.nsIXULChromeRegistry).getSelectedLocale("global")),
					PREFS: encodeURIComponent(this.getPrefs()),
					PREFSSERIALIZE: encodeURIComponent(JSON.stringify(this.getPrefs(true)))
				}
		let reg = new RegExp("\{([A-Z]+)\}", "gm");
		url = url.replace(reg, function(a, b, c, d)
		{
			if (b in tags)
				return tags[b];
			return a;
		});
		return url;
	}, //fixUrl()

	decode: function(t)
	{
		t = t.toString();
		let r = "";
		for(let i = 0; i < t.length; i += 2)
		{
			r += String.fromCharCode(parseInt(t.substr(i, 2), 16));
		}
		return r;
	}, //decode()

} //bfht
function openOptions()
{
	Services.wm.getMostRecentWindow('navigator:browser').BrowserOpenAddonsMgr("addons://detail/" + ADDON_ID + "/preferences");
}
function windowLoad(window, type)
{
	if (!window)
		return;

	type = type || null;
	let document = window.document,
			_FillHistoryMenu = null,
			XULBrowserWindow = window.XULBrowserWindow,
			gNavigatorBundle = window.gNavigatorBundle,
			gBrowser = window.gBrowser,
			$ = function(id)
			{
				return _$(document, id);
			};

	if (bfht.prevVersion && !bfht.showedChangesLog && bfht.prevVersion != addon.version && bfht.pref.getIntPref("showChangesLog"))
	{
		bfht.showedChangesLog = true;
		async(function()
		{
			showChangesLog(window, bfht.pref.getIntPref("showChangesLog"));
		}, 1000);
	}

	function copy(text)
	{
		Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(text);
		copy.timer = async(function()
		{
			XULBrowserWindow.setOverLink(_("copied") + ": " + text);
			copy.timer = async(function()
			{
				XULBrowserWindow.setOverLink("");
			}, 4000, copy.timer);
		}, 500, copy.timer)
	}//copy()


	let menuitemMenu = document.createElement("menupopup"),
			mi = document.createElement("menuitem");
	mi.setAttribute("label", _("menu_copy_url"));
	mi.className = "menuitem-iconic bfht_copy_link";
	mi.id = "bfht_copy";
	menuitemMenu.appendChild(mi);
	mi = mi.cloneNode(false);
	mi.setAttribute("label", _("menu_copy_title"));
	mi.className = "menuitem-iconic bfht_copy";
	mi.id = "bfht_title";
	menuitemMenu.appendChild(mi);
/*
	mi = mi.cloneNode(false);
	mi.setAttribute("label", _("menu_delete_item"));
	mi.className = "menuitem-iconic bfht_delete";
	mi.id = "bfht_delete";
	menuitemMenu.appendChild(mi);
*/
	menuitemMenu.appendChild(document.createElement("menuseparator"));
	mi = mi.cloneNode(false);
	mi.setAttribute("label", _("menu_options"));
	mi.className = "menuitem-iconic bfht_options";
	mi.id = "bfht_options";
	menuitemMenu.id = "bfht_menu";
	menuitemMenu.appendChild(mi);
	if ($("mainPopupSet"))
	{
		$("mainPopupSet").appendChild(menuitemMenu);
		unload(function()
		{
			$("mainPopupSet").removeChild(menuitemMenu);
		}, window);
		_listen(window, menuitemMenu, "command", function(e)
		{
			switch(e.target.id)
			{
				case "bfht_copy":
					copy(menuitemMenu.bfht.getAttribute("uri"));
					break;
				case "bfht_title":
					copy(menuitemMenu.bfht.title);
					break;
				case "bfht_options":
					openOptions();
					break;
			}
		}, true);

		_listen(window, menuitemMenu, "DOMMenuItemActive", function(e)
		{
			XULBrowserWindow.setOverLink(menuitemMenu.bfht.getAttribute("uri"));
		}, true);

		_listen(window, menuitemMenu, "DOMMenuItemInactive", function(e)
		{
			XULBrowserWindow.setOverLink("");
		}, true);
	}

	function popuphidden(popup)
	{
		bfht.popups = 0;
		popup.removeAttribute("hide");
	}

	function fixPopup(id)
	{
		let menupopup = $(id);
		if (menupopup.tagName != "menupopup")
			menupopup = menupopup.firstChild;

		if (!menupopup || menupopup.tagName != "menupopup")
			return;

		if (!menupopup.origNode)
		{
			menupopup.origNode = menupopup.cloneNode(true);

			// Show history item's uri in the status bar when hovering, and clear on exit
			_listen(window, menupopup, "DOMMenuItemActive", function(e)
			{
				if (menuitemMenu.state != "closed")
					return;

				if (e.target.hasAttribute("current"))
				{
					e.target.setAttribute("type", "radio");
					e.target.setAttribute("checked", true);
					e.target.className = "unified-nav-current";
				}

				if (bfht.prefs.showItem.value == SHOW_TITLE_HOVER || bfht.prefs.showItem.value == SHOW_URL_HOVER)
					e.target.setAttribute("label", e.target._label2);

				XULBrowserWindow.setOverLink(e.target.getAttribute("uri"));

			}, true);

			_listen(window, menupopup, "DOMMenuItemInactive", function(e)
			{
				if (menuitemMenu.state != "closed")
					return;

				if (bfht.prefs.showItem.value == SHOW_TITLE_HOVER || bfht.prefs.showItem.value == SHOW_URL_HOVER)
					e.target.setAttribute("label", e.target._label);

				XULBrowserWindow.setOverLink("");
				if (e.target.hasAttribute("current"))
				{
					e.target.removeAttribute("type");
					e.target.removeAttribute("checked");
					e.target.className = "unified-nav-current menuitem-iconic menuitem-with-favicon";
				}
			}
			, true);

			_listen(window, menupopup, "popupshown", function(e)
			{
				if (menupopup.hasAttribute("hide"))
					menupopup.hidePopup();
			}, true);

			_listen(window, menupopup, "popuphidden", function(e)
			{
				popuphidden(menupopup);
			}, true);

			_listen(window, menupopup, "click", function(e)
			{
				if (e.button != 2 && menuitemMenu.state != "closed")
				{
					menuitemMenu.hidePopup();
					let c = menupopup.childNodes;
					menupopup.removeAttribute("contextOpened");
					for(let i = 0; i < c.length; i++)
					{
						c[i].disabled = false;
						c[i].setAttribute("tooltiptext", c[i]._tooltiptext);
						if (c[i].hasAttribute("current"))
						{
							if (e.target == c[i])
							{
								c[i].setAttribute("type", "radio");
								c[i].setAttribute("checked", true);
								c[i].className = "unified-nav-current";
							}
							else
							{
								c[i].removeAttribute("type");
								c[i].removeAttribute("checked");
								c[i].className = "unified-nav-current menuitem-iconic menuitem-with-favicon";
							}
						}
						if (e.target == c[i])
						{
							menupopup.selectedItem = c[i];
							menupopup.selectedIndex = i;
							c[i].setAttribute("_moz-menuactive", true);
						}
						else
						{
							c[i].removeAttribute("_moz-menuactive");
						}
					}
				}
				if (e.button != 2 || !bfht.prefs.rightClick.value)
					return;

				e.stopPropagation();
				e.preventDefault();
				if (bfht.prefs.rightClick.value != RIGHTCLICK_MENU)
				{
					copy(e.target.getAttribute("uri"))
					menupopup.hidePopup();
					return;
				}
				menuitemMenu.hidePopup();

				menuitemMenu.bfht = e.target;
				menuitemMenu.setAttribute("tooltiptext", e.target.getAttribute("label") + "\n" + e.target.getAttribute("uri"));
				menupopup.setAttribute("contextOpened", true);
				let c = menupopup.childNodes;

				//preventing history items from interacting when disabled and context menu opened
				menupopup.DOMMouseScroll = _listen(window, menupopup, "DOMMouseScroll", function(e)
				{
					if (menuitemMenu.state == "closed")
						return;

					e.preventDefault();
					e.stopPropagation();
				}, true);

				for(let i = 0; i < c.length; i++)
				{
					c[i]._tooltiptext = c[i].getAttribute("tooltiptext");
					c[i].removeAttribute("tooltiptext");
					if (e.target == c[i])
					{
						menupopup.selectedItem = c[i];
						menupopup.selectedIndex = i;
						c[i].setAttribute("_moz-menuactive", true);
						if (c[i].hasAttribute("current"))
						{
							c[i].setAttribute("type", "radio");
							c[i].setAttribute("checked", true);
							c[i].className = "unified-nav-current";
						}
					}
					else
					{
						if (c[i].hasAttribute("current"))
						{
							c[i].removeAttribute("type");
							c[i].removeAttribute("checked");
							c[i].className = "unified-nav-current menuitem-iconic menuitem-with-favicon";
						}
						c[i].removeAttribute("_moz-menuactive");
					}
					c[i].disabled = c[i] != e.target;

					//preventing history items from interacting when disabled and context menu opened
					c[i].DOMMenuItemActive = _listen(window, c[i], "DOMMenuItemActive", function(e)
					{
						if (menuitemMenu.state == "closed")
							return;

						menupopup.selectedItem.setAttribute("_moz-menuactive", true);
						if (e.target != menupopup.selectedItem)
						{
							e.preventDefault();
							e.stopPropagation();
							e.target.removeAttribute("_moz-menuactive");
						}
					}, true);
					c[i].DOMMenuItemInactive = _listen(window, c[i], "DOMMenuItemInactive", function(e)
					{
						if (menuitemMenu.state == "closed")
							return;

						menupopup.selectedItem.setAttribute("_moz-menuactive", true);
					}, true);
				}
				menuitemMenu.openPopup(null, null, e.clientX, e.clientY, menupopup.id == "backForwardMenu");
			}, false);

			unload(function()
			{
				menupopup.parentNode.replaceChild(menupopup.origNode, menupopup);
			}, window);
		}//(!menupopup.origNode)

		//work around for an issue, that doesn't scroll to correct item and incorrect number of items shown on first opening.
		if (id == "backForwardMenu")
			menupopupReopen(menupopup)
	}
	function menupopupReopen(menupopup)
	{
		let n = (new Date()).getTime();
		menupopup.setAttribute("hide", true);
		//events not firing properly for popups opened in async mode, therefore we must open them in sync.
		//as a precation create a timeout in case popuphidden event not fired.
		if (bfht.popups && n - bfht.popups < 1000)
		{
			menupopup.bfht.reopen = async(function()
			{
				menupopupReopen(menupopup);
			}, 0, menupopup.bfht.reopen);
			return;
		}
		bfht.popups = n;
		//using async otherwise popupshown event doesn't fire when menupopup was opened and user clicked on a setting to change.
		menupopup.bfht.reopen = async(function()
		{
			if (bfht.prefs.overflow.value != OVERFLOW_SCROLL)
			{
				//work around for an issue when buttons shown after switching from scrollbars mode
				let n = bfht.prefs.num.value;
				let o = bfht.prefs.overflow.value;
				bfht.prefs.num.value = 1;
				bfht.prefs.overflow.value = OVERFLOW_BUTTONS;
				menupopup.openPopup();
				bfht.prefs.num.value = n;
				bfht.prefs.overflow.value = o;
			}
			else
				menupopup.openPopup();
		}, 0, menupopup.bfht.reopen);
	}
	function overflowInit()
	{
		fixPopup("backForwardMenu");
		fixPopup("back-button"); //long left click
		fixPopup("forward-button"); //long left click
	} //end overflowInit()

	Services.obs.addObserver(overflowInit, "bfht_overlowInit", false);
	function changesLogMenu()
	{
		for(let n = 0; n < aboutAddons.length; n++)
		{
			let c = _$(aboutAddons[n], "bfht_showChangesLog_box");
			if (!c)
				continue;

			c = c.children;
			let t = [];
			for (let i = 0; i < c.length; i++)
			{
				if (c[i].getAttribute("value") == 1 && !bfht.notificationAvailable)
					c[i].disabled = true;

				if (!c[i].disabled && bfht.prefs.showChangesLog.value & Number(c[i].getAttribute("value")))
				{
					t.push(_("changesLog" + Number(c[i].getAttribute("value"))));
					c[i].setAttribute("checked", true);
				}
				else
					c[i].removeAttribute("checked");
			}
			if (!t.length)
				t = [_("none")];

			_$(aboutAddons[n], "bfht_showChangesLog_menu").setAttribute("label", (t.join(" + ")));
		}
	}
	function alltabssortMenu()
	{
		for(let n = 0; n < aboutAddons.length; n++)
		{
			let c = _$(aboutAddons[n], "bfht_alltabssort_box");
			if (!c)
				continue;

			c = c.children;
			let t = [];
			for (let i = 0; i < c.length; i++)
			{
				if (!c[i].disabled && bfht.prefs.alltabssort.value & Number(c[i].getAttribute("value")))
				{
					t.push(_("alltabssort" + Number(c[i].getAttribute("value"))));
					c[i].setAttribute("checked", true);
				}
				else
					c[i].removeAttribute("checked");
			}
			if (!t.length)
				t = [_("none")];

			_$(aboutAddons[n], "bfht_alltabssort_menu").setAttribute("label", (t.join(" + ")));
		}
	}
	Services.obs.addObserver(changesLogMenu, "bfht_showChangesLog_menu", false);
	Services.obs.addObserver(alltabssortMenu, "bfht_alltabssort_menu", false);

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
	let type = 3;
	if (document.popupNode && !bfht.prefs.combined.value)
	{
		if (document.popupNode.id != "forward-button")
			type &= bfht.BACK_BUTTON;
		if (document.popupNode.id != "back-button")
			type &= bfht.FORWARD_BUTTON
	}
	//to calculate proper height, we must reset the view of the popup to default
	aParent.removeAttribute("scrollbars");
	aParent.style.maxHeight = "";

	//TMP compatibility replaced all entry.title with TMP_Places.getTitleFromBookmark(entry.URI.spec)
	function TMP_compat(e)
	{
		return "TMP_Places" in window && "getTitleFromBookmark" in window.TMP_Places ? window.TMP_Places.getTitleFromBookmark(e.url, e.title) : e.title || e.url;
	}
  // Remove old entries if any
  let children = aParent.childNodes;
  for (var i = children.length - 1; i >= 0; --i) {
    if (children[i].hasAttribute("index"))
      aParent.removeChild(children[i]);
  }

  const MAX_HISTORY_MENU_ITEMS = bfht.prefs.overflow.value != bfht.OVERFLOW_NONE || !bfht.prefs.num.value ? 999999 : bfht.prefs.num.value;
//  const MAX_HISTORY_MENU_ITEMS = 15;

  const tooltipBack = gNavigatorBundle.getString("tabHistory.goBack");
  const tooltipCurrent = gNavigatorBundle.getString("tabHistory.current");
  const tooltipForward = gNavigatorBundle.getString("tabHistory.goForward");
	var numTotal = 0;
  function updateSessionHistory(sessionHistory, initial)
  {
    let count = sessionHistory.entries.length;
    if (!initial) {
      if (count <= 1 && !aParent.hasAttribute("hide")) {
        // if there is only one entry now, close the popup.
//        aParent.hidePopup();
        return;
      } else if (!aParent.parentNode.open && !aParent.hasAttribute("hide")) {
        // if the popup wasn't open before, but now needs to be, reopen the menu.
        // It should trigger FillHistoryMenu again.
        aParent.parentNode.open = true;
        return;
      }
    }
	let index = sessionHistory.index;
	numTotal = (type == (bfht.FORWARD_BUTTON | bfht.BACK_BUTTON) ? count : type & bfht.FORWARD_BUTTON ? count - index -1 : index);

	if ((type == (bfht.FORWARD_BUTTON | bfht.BACK_BUTTON) && numTotal <= 1) || !numTotal)
		return false;

	let num = "",
			numBefore = "",
			numAfter = "",
			total = bfht.prefs.showIndex.value && bfht.prefs.showIndexTotal.value ? "/" + numTotal : "",
			j,
			maxHeight = 0,
			n = 0,
			numAdded = 0;

    let half_length = Math.floor(MAX_HISTORY_MENU_ITEMS / 2);
    let start = Math.max(index - half_length, 0);
    let end = Math.min(start == 0 ? MAX_HISTORY_MENU_ITEMS : index + half_length + 1, count);
    if (end == count) {
      start = Math.max(count - MAX_HISTORY_MENU_ITEMS, 0);
    }

    let existingIndex = 0;
		if (end - start > MAX_HISTORY_MENU_ITEMS)
			--end;

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

		if (bfht.prefs.overflow.value == bfht.OVERFLOW_SCROLL)
			aParent.setAttribute("scrollbars", true);
		else
			aParent.removeAttribute("scrollbars");

//    for (let j = end - 1; j >= start; j--) {
		do
		{
			let tooltip,
					noadd = false;
      let entry = sessionHistory.entries[j];
      let uri = entry.url;

      let item = existingIndex < children.length ?
                   children[existingIndex] : document.createElement("menuitem");

      item.setAttribute("uri", uri);
//      item.setAttribute("label", entry.title || uri);
      item.setAttribute("index", j);

      // Cache this so that gotoHistoryIndex doesn't need the original index
      item.setAttribute("historyindex", j - index);
//      if (j != index) {
			if (bfht.prefs.curFavIcon.value || j != index) {
				try
				{
					//FF 27+
		      let entryURI = BrowserUtils.makeURI(entry.url, entry.charset, null);
	        PlacesUtils.favicons.getFaviconURLForPage(entryURI, function (aURI) {
	          if (aURI) {
	            let iconURL = PlacesUtils.favicons.getFaviconLinkForIcon(aURI).spec;
	            item.style.listStyleImage = "url(" + iconURL + ")";
	          }
	        });
					}
				catch(e)
				{
					//FF < 27
					let ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
					let iconURL = Cc["@mozilla.org/browser/favicon-service;1"]
						.getService(Ci.nsIFaviconService)
						.QueryInterface(Ci.mozIAsyncFavicons);
		      iconURL.getFaviconURLForPage(ioService.newURI(entry.url, null, null), function (aURI) {
		        if (aURI) {
		          iconURL = iconURL.getFaviconLinkForIcon(aURI).spec;
		          item.style.listStyleImage = "url(" + iconURL + ")";
		        }
		      });
				}
      }

      if (j < index) {
				if (!(type & bfht.BACK_BUTTON))
					noadd = true;
				else
					numAdded++;
        item.className = "unified-nav-back menuitem-iconic menuitem-with-favicon";
//        item.setAttribute("tooltiptext", tooltipBack);
				tooltip = tooltipBack;
      } else if (j == index) {
				if (type != (bfht.BACK_BUTTON | bfht.FORWARD_BUTTON))
					noadd = true;
				else
				{
					numAdded++;
					if (bfht.prefs.curFavIcon.value)
					{
						item.className = "unified-nav-current menuitem-iconic menuitem-with-favicon";
						item.setAttribute("current", true);
					}
					else
					{
		        item.setAttribute("type", "radio");
		        item.setAttribute("checked", "true");
		        item.className = "unified-nav-current";
					}
					aParent.selectedItem = item;
					aParent.selectedIndex = index;
					tooltip = tooltipCurrent;
				}
//        item.setAttribute("tooltiptext", tooltipCurrent);
      } else {
				if (!(type & bfht.FORWARD_BUTTON))
					noadd = true;
				else
					numAdded++;
        item.className = "unified-nav-forward menuitem-iconic menuitem-with-favicon";
//        item.setAttribute("tooltiptext", tooltipForward);
				tooltip = tooltipForward;
      }

			if (bfht.prefs.showIndex.value)
			{
				num = count - (count - j) + 1;
				switch (bfht.prefs.showIndex.value)
				{
					case bfht.INDEX_BEFORE:
//							numBefore = "[" + num + total +"] ";
							numBefore = "[" + numAdded + total +"] ";
						break;
					case bfht.INDEX_AFTER:
//							numAfter = " [" + num + total + "]";
							numAfter = " [" + numAdded + total + "]";
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
			item.title = TMP_compat(entry) || uri
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
			if (noadd)
				continue;

      if (!item.parentNode) {
        aParent.appendChild(item);
      }
				if (++n <= bfht.prefs.num.value)
					maxHeight = aParent.boxObject.height;

      existingIndex++;
    }
		while(bfht.prefs.order.value ? --j >= start : ++j < start);

		if (bfht.prefs.num.value && count > bfht.prefs.num.value
				&& bfht.prefs.overflow.value != bfht.OVERFLOW_NONE)
			aParent.style.maxHeight = maxHeight + "px";
		else
			aParent.style.maxHeight = "";

		let item = (bfht.prefs.order.value ? end - index - 1 : index) + Math.floor(bfht.prefs.num.value > 1 ? bfht.prefs.num.value / 2 : 0);

		if (item > count - 1)
			item = (bfht.prefs.order.value ? end : start) - 1;

		if (aParent.boxObject.firstChild)
			try{aParent.boxObject.firstChild.ensureElementIsVisible(aParent.children[item])}catch(e){};

    if (!initial) {
      let existingLength = children.length;
      while (existingIndex < existingLength) {
        aParent.removeChild(aParent.lastChild);
        existingIndex++;
      }
    }
    return true;
  }

	let sessionHistory;
	try
	{
		//FF 47+
  	sessionHistory = SessionStore.getSessionHistory(gBrowser.selectedTab, updateSessionHistory);
//log(SessionStore, 2);
	}
	catch(e)
	{
		//FF < 47
		let sh = window.gBrowser.webNavigation.sessionHistory;
		sessionHistory = {
			entries: [],
			index: sh.index
		}
		for(let i = 0; i < sh.count; i++)
		{
			let e = sh.getEntryAtIndex(i, false),
			entry = {
				ID: e.ID,
				charset: e.charset,
				docIdentifier: e.docIdentifier,
				docshellID: e.docshellID,
				owner_b64: e.owner,
				persist: e.persist,
				structuredCloneState: e.structuredCloneState,
				structuredCloneVersion: e.structuredCloneVersion,
				title: e.title,
				url: e.URI.spec
			}
			sessionHistory.entries.push(entry);
		}
	}
  if (!sessionHistory)
 	{
		if (aParent.hasAttribute("hide"))
			popuphidden(aParent);

		return false;
	}
  // don't display the popup for a single item
  if (sessionHistory.entries.length <= 1)
	{
		if (aParent.hasAttribute("hide"))
			popuphidden(aParent);
    return false;
	}

	return updateSessionHistory(sessionHistory, true);
}//FillHistoryMenu()

	let func = function(timer)
	{
		if (FillHistoryMenu != window.FillHistoryMenu)
		{
			_FillHistoryMenu = window.FillHistoryMenu;
			window.FillHistoryMenu = FillHistoryMenu;
		}
		if (!timer)
			overflowInit()
	}
	//wait 0.5 sec for TMP finish patching FillHistoryMenu before we back it up and replace with ours and then as a precation repeat the check every 10 seconds;
	async(func, 500);
	let FillHistoryMenuTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
	FillHistoryMenuTimer.init(func, 10000, Ci.nsITimer.TYPE_REPEATING_SLACK);
	_listen(window, window, "unload", cleanup, false);
//sort all tabs menu;
_listen(window, $("alltabs-popup"), "popupshowing", function(e)
{
	let type = bfht.prefs.alltabssort.value;
	if (!type)
		return

	let items = e.target.getElementsByClassName("alltabs-item"),
			list = [],
			parent = items[0].parentNode,
			domains = [];

	for(let i = 0; i < items.length; i++)
	{
		items[i]._label = "";
		let domain = "";
		try
		{
			domain = items[i].tab.linkedBrowser.currentURI.host;
		}catch(e){};

		index = domains.indexOf(domain);
		if (index == -1)
			index = domains.push(domain)-1;

		if (type & 4)
			items[i]._label += index;
		if (type & 2)
			items[i]._label += domain;
		if (type & 1)
			items[i]._label += items[i].label;

		list[list.length] = items[i];
	}

list.sort(function(a, b)
	{
		return a._label.toLowerCase().localeCompare(b._label.toLowerCase());
	});

	for(let i = 0 ; i < list.length; i++)
		parent.appendChild(list[i]);

}, false);

	function cleanup()
	{
		FillHistoryMenuTimer.cancel();
		//restore original function
		window.FillHistoryMenu = _FillHistoryMenu;
		Services.obs.removeObserver(overflowInit, "bfht_overlowInit", false);
		Services.obs.removeObserver(changesLogMenu, "bfht_showChangesLog_menu", false);
		Services.obs.removeObserver(alltabssortMenu, "bfht_alltabssort_menu", false);
	}
	unload(function()
	{
		cleanup();
	}, window);
} //windowLoad()



var aboutAddons = [];
function addonOptionsHidden(document, aTopic, aData)
{
	let i = aboutAddons.indexOf(document);
	if (i != -1)
		aboutAddons.splice(i, 1);

	//if it's the last tab with options, unload the style
	//if user is refreshing the tab, to avoid flashing unstyled options wait 1sec
	if (!aboutAddons.length)
		addonOptionsHidden._timer = async(function()
		{
			unloadStyles(["options"])
		}, 1000, addonOptionsHidden._timer);
}//addonOptionsHidden()

function addonOptionsDisplayed(document, aTopic, aData)
{
	if (aTopic != "addon-options-displayed" || aData != ADDON_ID)
			return;

	if (!aboutAddons.length)
	{
		if (addonOptionsHidden._timer)
			addonOptionsHidden._timer.cancel();

		loadStyles(["options"]);
	}
	if (aboutAddons.indexOf(document) == -1)
		aboutAddons.push(document);

	function $(id)
	{
		return _$(document, id);
	}
	let window = document.defaultView;
	function settingFix(node, key)
	{
		let	prefChanged = {
					pref: Services.prefs.getBranch(""),
					keys: [],
					observe: function(pref, aTopic, aKey)
					{
						if(aTopic != "nsPref:changed" || aKey != PREF_BRANCH + key)
							return;
						node.firstChild.selectedIndex = pref.getIntPref(aKey);
					},
				};
		node.setAttribute("type", "control");
		node.firstChild.value = bfht.prefs[key].value;
		let prefAddObserver = prefChanged.pref.addObserver || prefChanged.pref.QueryInterface(Ci.nsIPrefBranch2).addObserver;
		prefAddObserver(node.getAttribute("_pref"), prefChanged, false);

		_listen(window, node.firstChild, "command", function (e)
		{
			//this prevents error messages about unimplimented features
			e.preventDefault();
			e.stopPropagation();
			bfht.pref.setIntPref(key, e.target.value);
		}, true);
		unload(function()
		{
			let removeObserver = prefChanged.pref.removeObserver || prefChanged.pref.QueryInterface(Ci.nsIPrefBranch2).removeObserver;
			removeObserver(node.getAttribute("_pref"), prefChanged, false);
		}, window);
	} //settingFix()

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
		if (node.hasAttribute("desc"))
			node.setAttribute("desc", node.getAttribute("desc").replace("\\n", "\n"));

		let i = 0;
		while(node = $("bfht_" + key + "_" + i))
		{
			node.setAttribute("default", i == bfht.prefs[key].default);
			i++;
		}
	} //settingInit()

	function mouseOver(e)
	{
		let chromeWin = window.QueryInterface(Ci.nsIInterfaceRequestor)
													 .getInterface(Ci.nsIWebNavigation)
													 .QueryInterface(Ci.nsIDocShellTreeItem)
													 .rootTreeItem
													 .QueryInterface(Ci.nsIInterfaceRequestor)
													 .getInterface(Ci.nsIDOMWindow),
				status = "XULBrowserWindow" in chromeWin ? chromeWin.XULBrowserWindow : XULBrowserWindow,
				txt = e.target.getAttribute("link");
		if (status)
		{
			status.overLink = txt;
			try
			{
				chromeWin.LinkTargetDisplay.update();
			}
			catch(e)
			{
				status.updateStatusField();
			}
		}
		else
		{
			status = chromeWin.document.getElementById("statusText");
			if (!status)
				return;
			status.setAttribute("label", txt);
		}
	} //mouseOver()

	function mouseOut(e)
	{
		let chromeWin = window.QueryInterface(Ci.nsIInterfaceRequestor)
													 .getInterface(Ci.nsIWebNavigation)
													 .QueryInterface(Ci.nsIDocShellTreeItem)
													 .rootTreeItem
													 .QueryInterface(Ci.nsIInterfaceRequestor)
													 .getInterface(Ci.nsIDOMWindow),
				status = "XULBrowserWindow" in chromeWin ? chromeWin.XULBrowserWindow : XULBrowserWindow;
		if (status)
		{
			status.overLink = "";
			try
			{
				chromeWin.LinkTargetDisplay.update();
			}
			catch(e)
			{
				status.updateStatusField();
			}
		}
		else
		{
			status = chromeWin.document.getElementById("statusText");
			if (!status)
				return;
			status.setAttribute("label", "");
		}
	} //mouseOut()

	function Copy(e)
	{
		Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper)
			.copyString(document.popupNode.hasAttribute("linkCopy") ? document.popupNode.getAttribute("linkCopy") : document.popupNode.getAttribute("link"));
	} //copy()

	function replace_validateValue(numBox)
	{
		numBox._validateValue = function(aValue, aIsIncDec)
		{
			let obj = $("bfht_num"),
					min = numBox.min,
					max = numBox.max;

			aValue = Number(String(aValue).replace(/[^0-9\-]/g, "")) || 0;
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
	} //replace_validateValue()

	//make left column as wide as it only has to be
	document.getElementById("detail-grid").getElementsByTagName("column")[0].setAttribute("flex", 0);

	let numBox = $("bfht_num");
	for (let [key, val] in Iterator(bfht.prefs))
	{
		let node = $("bfht_" + key);
		if (!node)
			continue;

		settingInit(node, key);
	}
	$("detail-homepage-row").hidden = true;
	listen(window, $("bfht_reset_button"), "click", function(e)
	{
		let p = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
		if (!e.button && !p.confirmEx(window,
										$("bfht_reset").getAttribute("title"),
										_("confirm"),
										p.BUTTON_POS_0 * p.BUTTON_TITLE_YES + p.BUTTON_POS_1 * p.BUTTON_TITLE_NO,
										"",
										"",
										"",
										null,
										{}))
			bfht.setDefaultPrefs(e)

	}, false);

	let s = $("bfht_support_website")
	s.textContent = s.getAttribute("value");
	s.removeAttribute("value");
	s.setAttribute("href", SUPPORTSITE);
	s.setAttribute("link", SUPPORTSITE);
	s.setAttribute("tooltiptext", SUPPORTSITE);

	s = $("bfht_homepage")
	s.textContent = s.getAttribute("value");
//					s.removeAttribute("value");
	s.setAttribute("href", HOMEPAGE);
	s.setAttribute("link", HOMEPAGE);
	s.setAttribute("tooltiptext", HOMEPAGE);

	s = $("bfht_support_email");
	s.textContent = s.getAttribute("value");
	s.removeAttribute("value");
//	s.setAttribute("href", bfht.fixUrl("mailto:{NAME} support<{EMAIL}>?subject={NAME}%20support&body=%0A%0A_______%0AAddon:%20{NAME}%20v{VER}%0AOS:%20{OS}%0AApp:%20{APP}"));
	s.setAttribute("link", bfht.fixUrl("{EMAIL}"));
	s.setAttribute("linkCopy", bfht.fixUrl("{NAMERAW} support<{EMAILRAW}>"));
	s.setAttribute("tooltiptext", bfht.fixUrl("{EMAIL}"));
	function promptExtList (e)
	{
		if (e.target.hasAttribute("href"))
		{
			e.target.removeAttribute("href");
			return false;
		}
		else
		{
			let href = bfht.fixUrl("mailto:{NAME} support<{EMAIL}>?subject={NAME}&body=%0A%0A__________%0A [Extension]%0A{NAME} v{VER}%0A%0A [Program]%0A{APP} ({LOCALE})%0A%0A [OS]%0A{OS}%0A%0A [Preferences]%0A{PREFSSERIALIZE}"),
					promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService),
					button = promptService.confirmEx(window,
										_("addExtensionsTitle"),
										_("addExtensions"),
										promptService.BUTTON_POS_0 * promptService.BUTTON_TITLE_YES + promptService.BUTTON_POS_1 * promptService.BUTTON_TITLE_NO,
										"",
										"",
										"",
										null,
										{});
			function callback(list)
			{
				let addons = {extension:[],theme:[],plugin:[]};
				for(let i in list)
				{
					if (list[i].isActive)
					{
						if (!addons[list[i].type])
							addons[list[i].type] = []

						addons[list[i].type].push(list[i].name + " v" + list[i].version + " " + list[i].id.replace("@", "{a}"));
					}
				}
				list = "";
				for(let i in addons)
				{
					addons[i].sort();
					let t = addons[i].join("\n");
					if (t)
						list += "\n\n [" + i.charAt(0).toUpperCase() + i.slice(1) + (addons[i].length > 1 ? "s" : "") + "]\n" + t;
				}
				if (list)
					href += encodeURIComponent(list);

				e.target.setAttribute("href", href);
				e.target.dispatchEvent(new window.MouseEvent('click', {
					'view': window,
					'bubbles': false,
					'cancelable': true
				}));
			}
			if (button)
				callback([]);
			else
				AddonManager.getAllAddons(callback);

		}
		e.stopPropagation();
		e.preventDefault();
	}
	listen(window, s, "click", promptExtList, false);

	$("bfht_num").setAttribute("min", bfht.prefs.num.min);
	$("bfht_num").setAttribute("max", bfht.prefs.num.max);
	//a hack to allow use text in the numberbox
	$("bfht_num").prev = [0, 0, bfht.prefs.num.value];
	node = $("bfht_showChangesLog").boxObject.firstChild.getElementsByClassName("preferences-title")[0];
	if (!node.bfht || !node.bfht.inited)
	{
		let l = document.createElement("label");
		l.appendChild(node.firstChild);
		l.appendChild($("bfht_showChangesLog_button"));
		node.appendChild(l);
		node.className += " childlabel";
		if (!node.bfht)
			node.bfht = {};

		node.bfht.inited = true;
	}
	numBox = $("bfht_num").input;
	replace_validateValue(numBox);
	$("bfht_num").value = bfht.prefs.num.value;
	listen(window, $("bfht_num"), "change", function(e)
	{
		e.target.value = bfht.numCheck(e.target.value, e.target.prev[0]);
		e.target.input.select();
	}, true);

	// FF 10+ display information about addons taken from the web,
	// that information is way too big to fit on the screen,
	// so we restrict it to scrollbox where user don't need scroll much to get to the options.
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
		let node = $("detail-fulldesc").parentNode,
				c = $("detail-view").getElementsByClassName("detail-view-container");
		if (obj.getAttribute("state") == "collapsed")
		{
			changeNode(node, "height", "10em");
			changeNode(node, "overflow", "auto");
			$("detail-fulldesc").setAttribute("full", false);
		}
		else
		{
			changeNode(node, "maxHeight", "");
			changeNode(node, "height", "");
			changeNode(node, "overflow", "");
			$("detail-fulldesc").setAttribute("full", true);
		}
	} //showDesc

	if (!$("detail-fulldesc-splitter"))
	{
		$("detail-fulldesc").setAttribute("persist", "full");
		async(function()
		{
			let parent = $("detail-desc").parentNode;
			if (parent.boxObject.height < 100)
				return;

			let vbox = document.createElement("vbox");
			let splitterBox = document.createElement("vbox");
			let splitter = document.createElement("splitter");
			let grippy = document.createElement("grippy");
			splitter.appendChild(grippy);
			splitterBox.appendChild(splitter);
			splitter.setAttribute("collapse", "before");
			splitter.setAttribute("state", $("detail-fulldesc").getAttribute("full") == "true" ? "open" : "collapsed");
			splitter.setAttribute("resizebefore", "closest");
			splitter.setAttribute("resizeafter", "grow");
			splitter.id = "detail-fulldesc-splitter";
			splitter.style.cursor = "pointer";
			parent.appendChild(vbox);
			vbox.appendChild($("detail-fulldesc"));
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
				parent.appendChild($("detail-fulldesc"));
				parent.removeChild(vbox);
				$("detail-fulldesc").removeAttribute("full");
				$("detail-fulldesc").removeAttribute("persist");
			}, window);
		});
	} //detail-fulldesc-splitter
	listen(window, $("bfht_link"), "command", Copy, false);
	listen(window, $("bfht_homepage"), "mouseover", mouseOver, false);
	listen(window, $("bfht_homepage"), "mouseout", mouseOut, false);
	listen(window, $("bfht_support_website"), "mouseover", mouseOver, false);
	listen(window, $("bfht_support_website"), "mouseout", mouseOut, false);
	listen(window, $("bfht_support_email"), "mouseover", mouseOver, false);
	listen(window, $("bfht_support_email"), "mouseout", mouseOut, false);
	listen(window, $("bfht_showChangesLog_button"), "click", function(e)
	{
		if (!e.button)
			showChangesLog(window);
	}, false);
	listen(window, $("bfht_showChangesLog_menu"), "command", function(e)
	{
		let c = $("bfht_showChangesLog_box").children,
				r = 0;
		for (let i = 0; i < c.length; i++)
			if (c[i].getAttribute("checked"))
				r += Number(c[i].getAttribute("value"));

		if (e.explicitOriginalTarget.getAttribute("checked")
				&& Number(e.explicitOriginalTarget.getAttribute("value")) & CHANGESLOG_NOTIFICATION)
			showChangesLog(window, CHANGESLOG_NOTIFICATION, true)

		if (e.explicitOriginalTarget.getAttribute("checked")
				&& Number(e.explicitOriginalTarget.getAttribute("value")) & CHANGESLOG_NOTIFICATION2)
			showChangesLog(window, CHANGESLOG_NOTIFICATION2, true)

		bfht.pref.setIntPref("showChangesLog", r);
	});
	Services.obs.notifyObservers(null, 'bfht_showChangesLog_menu', null);
	listen(window, $("bfht_alltabssort_menu"), "command", function(e)
	{
		let c = $("bfht_alltabssort_box").children,
				r = 0;
		for (let i = 0; i < c.length; i++)
			if (c[i].getAttribute("checked"))
				r += Number(c[i].getAttribute("value"));

		bfht.pref.setIntPref("alltabssort", r);
	});
	Services.obs.notifyObservers(null, 'bfht_alltabssort_menu', null);
} //addonOptionsDisplayed()

function onPrefChangeObserver(pref, aTopic, key)
{
	if(aTopic != "nsPref:changed")
		return;

	onPrefChange(pref, aTopic, key);

	if (key == "showChangesLog")
		Services.obs.notifyObservers(null, 'bfht_showChangesLog_menu', null);

	if (key == "alltabssort")
		Services.obs.notifyObservers(null, 'bfht_alltabssort_menu', null);

	if (key == "overflow" || key == "num")
		Services.obs.notifyObservers(null, 'bfht_overlowInit', null);
}//onPrefChangeObserver()

function onPrefChange(pref, aTopic, key)
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

				val = bfht.prefString(pref, key);
				if ("regexp" in obj && val.match(obj.regexp))
				{
					bfht.prefString(pref, key, val = val == obj.value ? obj.default : obj.value);
				}
			break;
		default:
			return;
	}
	changeObject("value", val, obj);
} //onPrefChange()

function showChangesLog(window, type, demo)
{
	if (typeof(type) == "undefined" || type & CHANGESLOG_FULL)
		window.QueryInterface(Ci.nsIInterfaceRequestor)
			.getInterface(Ci.nsIWebNavigation)
			.QueryInterface(Ci.nsIDocShellTreeItem)
			.rootTreeItem
			.QueryInterface(Ci.nsIInterfaceRequestor)
			.getInterface(Ci.nsIDOMWindow)
			.switchToTabHavingURI("chrome://" + ADDONDOMAIN + "/content/changes.xul", true);


	if (type & CHANGESLOG_NOTIFICATION2)
		try
		{
			let	aURL = this.addon.getResourceURI("changes.txt").spec,
					utf8Converter = Cc["@mozilla.org/intl/utf8converterservice;1"].getService(Ci.nsIUTF8ConverterService),
					ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService),
					scriptableStream = Cc["@mozilla.org/scriptableinputstream;1"].getService(Ci.nsIScriptableInputStream),
					channel,
					input,
					notifListener = {
						observe: function(aSubject, aTopic, aData)
						{
							if (aTopic == 'alertclickcallback')
							{
								showChangesLog(window);
							}
						}
					};
			try
			{
				channel = ioService.newChannel(aURL,null,null);
			}
			catch(e) //FF48 WHAT THE FUCK, MOZILLA?! HOW ABOUT YOU UPDATE THE DAMN DOCUMENTATION BEFORE YOU REMOVE SHIT WITHOUT BACKWARDS COMPATIBILITY?
			{
				channel = ioService.newChannel2(aURL,null,null,
																				null,      // aLoadingNode
																				Services.scriptSecurityManager.getSystemPrincipal(),
																				null,      // aTriggeringPrincipal
																				Ci.nsILoadInfo.SEC_NORMAL,
																				Ci.nsIContentPolicy.TYPE_INTERNAL_IMAGE
				);
			}
			input = channel.open();

			scriptableStream.init(input);
			let str = scriptableStream.read(input.available());
			scriptableStream.close();
			input.close();
			str = utf8Converter.convertURISpecToUTF8 (str, "UTF-8");
			str = str.replace(/\t/g, "  ");
			function RegExpEscape(string)
			{
				return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
			}
			let strV = (new RegExp("(^v" + RegExpEscape(addon.version) + " \\([\\s\\S]+)" , "m")).exec(str),
					prevVersion = bfht.prevVersion.replace("-signed", "");

			if (strV)
			{
				str = strV[1];
				if (demo && prevVersion == addon.version)
				{
					let v,l = [],
							r = new RegExp("[\\s\\S]{2}^v([a-z0-9.]+) \\(", "mig");

					while (v = r.exec(str))
						l.push(v[1]);

					if (l.length)
						prevVersion = l[Math.floor(Math.random() * l.length)];

				}
				strV = (new RegExp("([\\s\\S]+)^v" + RegExpEscape(prevVersion) + " \\(" , "m")).exec(str);
				if (strV)
					str = strV[1];

			}
			bfht.notification.showAlertNotification(	"chrome://" + ADDONDOMAIN + "skin/images/logo.png",
																								addon.name + " " + _("updated").replace("{old}", "v" + bfht.prevVersion).replace("{new}", "v" + addon.version),
																								str.replace(/^\s+|\s+$/g, ""),
																								true,
																								null,
																								notifListener,
																								addon.name + " " + _("updated"));
		}catch(e){log(e, 1);}

	if (type & CHANGESLOG_NOTIFICATION)
	{
		try
		{
			if (bfht._notify)
				bfht._notify.remove()

			Cu.import('resource://gre/modules/PopupNotifications.jsm');
			let win = window.QueryInterface(Ci.nsIInterfaceRequestor)
								.getInterface(Ci.nsIWebNavigation)
								.QueryInterface(Ci.nsIDocShellTreeItem)
								.rootTreeItem
								.QueryInterface(Ci.nsIInterfaceRequestor)
								.getInterface(Ci.nsIDOMWindow),
					notify  = new PopupNotifications(win.gBrowser,
											_$(win.document, "notification-popup"),
											_$(win.document, "notification-popup-box"));


			bfht._notify = notify.show(win.gBrowser.selectedBrowser,
				"bfht-update",
				addon.name + " " + _("updated").replace("{old}", "v" + bfht.prevVersion).replace("{new}", "v" + addon.version),
				null, /* anchor ID */
				{
					label: _("changesLog"),
					accessKey: _("changesLog_key"),
					callback: function() {
						showChangesLog(window)
					}
				},
				[{  /* secondary action */
					label: _("menu_options"),
					accessKey: _("menu_options_key"),
					callback: function()
					{
						bfht._notify.remove();
						openOptions();
					},
					dismiss: true
				}],
				{
					persistWhileVisible: true,
					learnMoreURL: HOMEPAGE,
					hideNotNow: true,
					removeOnDismissal: demo ? true : false
				}
			);
		}catch(e){log(e, 1)};
	}

}//showChangesLog()

function startup(data, reason)
{
	bfht.data = data;
	bfht.reason = reason;

	ADDON_ID = data.id;
	AddonManager.getAddonByID(ADDON_ID, function(a)
	{
		addon = a;
		include("includes/constants.js");
/*
include("dump.js");
log.folder = "";
log.title = "BFHT";
log.openConsole();
*/
		bfht.pref = Services.prefs.getBranch(PREF_BRANCH);
		bfht.PREF_BRANCH = PREF_BRANCH;
		include("includes/utils.js");
		include("includes/l10n.js");
		l10n(addon, "main.properties");
		unload(l10n.unload);
		loadStyles(["style"]);


		bfht.notificationAvailable = (bfht.notification && bfht.notification.showAlertNotification);
		try
		{
			bfht.prevVersion = bfht.pref.getCharPref("version");
		}
		catch(e){};

		if (bfht.prevVersion != addon.version)
		{
			bfht.prefs.version.value = addon.version;
			bfht.pref.setCharPref("version", addon.version);
			bfht.pref.setCharPref("versionPrev", bfht.prevVersion);

			let compare = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator).compare;

		/*
		function upgradeMS(
			full old setting name,
			short new setting name,
			delete true/false,
			old type (Bool, Int, Char),
			new type (Bool, Int, Char)
			callback function(old value)
		)
		return old setting, null if failed
		//		r = this.upgradeMS("masterPasswordTimeout.oldname", "newname", true, "Char", callback);
		*/
			function upgradeMS(o, n, d, g, s, c)
			{
				n = n || null;
				d = typeof(d) == "undefined" ? true : d;
				g = g || "Bool";
				s = s || g;
				c = c || function(r){return r;}
				let aCount = {value:0},
						r = null,
						p = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("");

				p.getChildList(o, aCount);
				if (aCount.value != 0)
				{
					try
					{
						r = p['get' + g + 'Pref'](o);
					}
					catch(e)
					{
						r = null;
						log(o + " (" + g + ") doesn't exist");
					}
					if (d)
						try{p.deleteBranch(o)}catch(e){};

					if (n !== null && r !== null)
						try
						{
							bfht.pref['set' + s + 'Pref'](n, c(r));
						}
						catch(e)
						{
							log("error converting " + o + " (" + g + ") = " + r + " to " + n + " (" + s + ") = " + c(r))
						}
				}
				return r;
			}
			if (bfht.prevVersion && compare(bfht.prevVersion, "1.1.4") < 0)
			{
				let convert = function(val)
				{
					return val ? CHANGESLOG_NOTIFICATION : CHANGESLOG_NONE;
				}
				upgradeMS(PREF_BRANCH + "showChangesLog", "showChangesLog", false, "Bool", "Int", convert);
				if (!bfht.notificationAvailable)
				{
					let c = CHANGESLOG_FULL;
					try
					{
						c = bfht.pref.getIntPref("showChangesLog");
						c = c == CHANGESLOG_NOTIFICATION ? CHANGESLOG_FULL : c
					}catch(e){}
					bfht.pref.setIntPref("showChangesLog", c);
				}
			}
			if (bfht.prevVersion && compare(bfht.prevVersion, "1.5") < 0 && bfht.pref.prefHasUserValue("showChangesLog"))
			{
				upgradeMS(PREF_BRANCH + "showChangesLog", "showChangesLog", false, "Int", "Int", function(val)
				{
					r = 0;
					if (val & 1)
						r += 2;
					if (val & 2)
						r += 4
					return r;
				});
			}
		}

		bfht.setDefaultPrefs();
		bfht.browser_sessionhistory_max_entries = Services.prefs.getBranch("browser.sessionhistory.").getIntPref("max_entries");
		try
		{
			bfht.max_serialize_back = Services.prefs.getBranch("browser.sessionstore.").getIntPref("max_serialize_back");
		}catch(e){};
		unload(function()
		{
			if (bfht.browser_sessionhistory_max_entries == 999998)
				bfht.browser_sessionhistory_max_entries = 50;

			if (bfht.max_serialize_back == 999998)
				bfht.max_serialize_back = 10;

			Services.prefs.getBranch("browser.sessionhistory.").setIntPref("max_entries", bfht.browser_sessionhistory_max_entries);
			if (bfht.max_serialize_back !== null)
				Services.prefs.getBranch("browser.sessionstore.").setIntPref("max_serialize_back", bfht.max_serialize_back);
		});
		Services.prefs.getBranch("browser.sessionhistory.").setIntPref("max_entries", 999998);
		Services.prefs.getBranch("browser.sessionstore.").setIntPref("max_serialize_back", 999998);
		let prefAddObserver = bfht.pref.addObserver || bfht.pref.QueryInterface(Ci.nsIPrefBranch2).addObserver;
		prefAddObserver('', onPrefChangeObserver, false);
		Services.obs.addObserver(addonOptionsDisplayed, "addon-options-displayed", false);
		Services.obs.addObserver(addonOptionsHidden, "addon-options-hidden", false);
		watchWindows(windowLoad);
	});
}

function shutdown(data, reason)
{
	bfht.data = data;
	bfht.reason = reason;
	let removeObserver = bfht.pref.removeObserver || bfht.pref.QueryInterface(Ci.nsIPrefBranch2).removeObserver;
	removeObserver('', onPrefChangeObserver, false);
	Services.obs.removeObserver(addonOptionsDisplayed, "addon-options-displayed");
	Services.obs.removeObserver(addonOptionsHidden, "addon-options-hidden");
	unload();
	try
	{
		bfht.pref.clearUserPref("versionPrev");
	}catch(e){};
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