var changesLog;
(function()
{
let {classes: Cc, interfaces: Ci, utils: Cu} = Components,
		self = this,
		log = console.log;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

function $(id)
{
	return document.getElementById(id);
}
function storage(id, data)
{
	let r = storage.list[id];
	if (typeof(data) == "undefined")
	{
		return r;
	}

	if (!(id in storage.list))
		storage.list[id] = {};

	storage.list[id] = data;
	storage.save();
	return r;
}
storage.obj = $("storage");
storage.list = {};

storage.save = function()
{
	storage.obj.setAttribute("value", JSON.stringify(storage.list));
}
storage.delete = function(id)
{
	delete storage.list[id];
	storage.save();
}

changesLog = {
	addon: null,
	pref: null,
	GUID: "backforwardhistorytweaks@vano",
	firstBox: null,
	decode: function(t)
	{
		t = t.toString();
		let r = "";
		for(let i = 0; i < t.length; i += 2)
		{
			r += String.fromCharCode(parseInt(t.substr(i, 2), 16));
		}
		return r;
	},

	mouseOver: function(e)
	{
		changesLog.statusText(e.target.getAttribute("link"));
	},

	mouseOut: function(e)
	{
		changesLog.statusText("");
	},

	statusText: function(txt)
	{
		let status = "XULBrowserWindow" in changesLog.rootWin ? changesLog.rootWin.XULBrowserWindow : null;

		if (status)
		{
			status.overLink = txt;
			try
			{
				rootWin.LinkTargetDisplay.update();
			}
			catch(e)
			{
				status.updateStatusField();
			}
		}
		else
		{
			status = changesLog.rootDoc.getElementById("statusText");
			if (!status)
				return;

			status.setAttribute("label", txt);
		}
	},

	copyMenu: function(e)
	{
		changesLog.copy(document.popupNode.hasAttribute("linkCopy") ? document.popupNode.getAttribute("linkCopy") : document.popupNode.hasAttribute("link") ? document.popupNode.getAttribute("link") : document.popupNode.getAttribute("href"));
	},

	copy: function(txt)
	{
		Cc["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Ci.nsIClipboardHelper)
			.copyString(txt);

		changesLog.copy.timer = changesLog.async(function()
		{
			changesLog.statusText(changesLog._("copied") + ": " + txt);
			changesLog.copy.timer = changesLog.async(function()
			{
				changesLog.statusText("");
			}, 5000, changesLog.copy.timer);
		}, 500, changesLog.copy.timer);
	},

	async: function(callback, time, timer)
	{
		if (timer)
			timer.cancel();
		else
			timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);

		timer.init({observe:function()
		{
			callback();
		}}, time || 0, timer.TYPE_ONE_SHOT);
		return timer;
	},//async()

	context: function(e)
	{
		let sel = window.getSelection();
		if (e.originalTarget.id == "changesLogCopy")
		{
			if (sel.rangeCount > 0)
			{
//				let txt = sel.getRangeAt(0).toString();
				let txt = sel.toString();
				if (this.checkboxGet("changesLogCopyIssueUrl") && (ISSUESSITE || SOURCESITE))
				{
					txt = txt.replace(/(^|[\s,.;:\(])(#([0-9a-z]{1,40}))/g, function(a, b, c, d)
					{
						if (d.length > 3 && d.match(/[a-z]/))
							return a + " (" + SOURCESITE + d + ")";

						return a + " (" + ISSUESSITE + d + ")";
					});
				}
				changesLog.copy(txt);
			}
		}
		else if (e.originalTarget.id == "changesLogCopyLink")
		{
			changesLog.copy(document.popupNode.hasAttribute("linkCopy") ? document.popupNode.getAttribute("linkCopy") : document.popupNode.getAttribute("link"));
		}
		else if (e.originalTarget.id == "changesLogSelectAll")
		{
			sel.removeAllRanges();
			$("changesLog").focus();
			sel.selectAllChildren($("changesLog"));
		}
	},

	popup: function(e)
	{
		let txt = window.getSelection().toString(),
				link = document.popupNode.hasAttribute("linkCopy") ? document.popupNode.getAttribute("linkCopy") : document.popupNode.getAttribute("link");
		if (txt)
			$("changesLogCopy").removeAttribute("disabled");
		else
			$("changesLogCopy").setAttribute("disabled", true);

		$("changesLogCopy").collapsed = !txt && link;
		$("changesLogCopyLink").collapsed = !link;
	},

	highlight: function(e)
	{
		let val = Number($("changesLogHightlight").getAttribute("value"))+1;
		if (val > 2 || val < 0)
			val = 0;
		$("changesLogHightlight").setAttribute("value", val);
		this.showHighlight();
	},

	showHighlight: function()
	{
		let c = $("changesLogHightlight");
		if (!c)
			return;

		let val = Number(c.getAttribute("value"));
		if (val == 1)
		{
			c.setAttribute("checked", true);
			c.setAttribute("indeterminate", true);
		}
		else if (val == 2)
		{
			c.setAttribute("checked", true);
			c.removeAttribute("indeterminate");
		}
		else
		{
			c.removeAttribute("checked");
			c.removeAttribute("indeterminate");
		}
		$("changesLog").setAttribute("highlight", val)
	},

	legend: function(e)
	{
		this.checkboxSet(e.target.id);
		this.showLegend();
	},

	showLegend: function()
	{
		let val = this.checkboxGet("changesLogLegend");
		$("changesLog").setAttribute("legend", val && !$("changesLogLegend").disabled ? val : 0)
	},

	legendType: function(e)
	{
		this.checkboxSet(e.target.id);
		this.showLegendType();
	},

	showLegendType: function()
	{
		if (!$("changesLog"))
			return;

		let val = this.checkboxGet("changesLogLegendType") ? 0 : 1;
		$("changesLog").setAttribute("type", val)
		$("changesLogLegend").disabled = val ? true : false;
		this.showLegend();
	},

	wrap: function(e)
	{
		this.checkboxSet(e.target.id);
		this.showWrap();
	},

	showWrap: function()
	{
		let val = this.checkboxGet("changesLogWrap"),
				b = $("changesLog");

		if (!b)
			return;

		if (val == 1)
		{
			b.setAttribute("flex", 1);
			b.parentNode.setAttribute("flex", 1);
		}
		else
		{
			b.setAttribute("flex", 0);
			b.parentNode.setAttribute("flex", 0);
		}
		$("changesLog").setAttribute("wrap", val)
		this.onResize();
	},

	altbg: function(e)
	{
		let val = this.checkboxSet(e.target.id)
		this.showAltbg();
	},

	showAltbg: function()
	{
		if (!$("changesLog"))
			return;
		let val = this.checkboxGet("changesLogAltBg");
		$("changesLog").setAttribute("altbg", val)
		this.onResize();
	},

	_expandAll: function _expandAll(e)
	{
		let val = this.checkboxSet(e.target.id)
		this.showExpandAll(true);
	},

	showExpandAll: function showExpandAll(init)
	{
		if (!$("changesLog"))
			return;

		let val = this.checkboxGet("changesLogExpandAll");
		$("changesLog").setAttribute("hide", val^1);
		let versions = document.getElementsByClassName("titlelog");
		for(let i = 0; i < versions.length; i++)
		{
			let hbox = versions[i];
			if (!hbox.getAttribute("latest"))
				this.showHideVersion(hbox, init);
		}

		this.onResize();
	},

	copyIssueUrl: function(e)
	{
		this.checkboxSet(e.target.id);
	},

	checkboxSet: function(id, val)
	{
		let c = $(id);
		if (typeof(val) == "undefined")
			val = Number(c.getAttribute("value")) + 1;

		if (val > 1 || val < 0)
			val = 0;
		c.setAttribute("value", val);

		if (val == 1)
			c.setAttribute("checked", true);
		else
			c.removeAttribute("checked");
		return val;
	},

	checkboxGet: function(id)
	{
		let node = $(id);
		if (!node)
			return 0;

		let val = Number(node.getAttribute("value"));
		return this.checkboxSet(id, val);
	},

	openOptions: function()
	{
		Services.wm.getMostRecentWindow('navigator:browser').BrowserOpenAddonsMgr("addons://detail/" + changesLog.addon.id + "/preferences");
	},

	onResize: function ()
	{
		let hbox = document.getElementsByAttribute("line", ""),
				height = changesLog.firstBox;
		if (!height)
			return;

		height = height.firstChild.boxObject.height;
		for(let i = 0; i < hbox.length; i++)
		{
			if (hbox[i].boxObject.height - height > height / 2)
				hbox[i].setAttribute("wrapped", "");
			else
				hbox[i].removeAttribute("wrapped")
		}
	},

	onload: function onload()
	{
		if (!("arguments" in window) || !window.arguments)
			document.documentElement._buttons.accept.hidden = true;
		else
		{
			document.documentElement.boxObject.lastChild.insertBefore($("changesLogSupport"), document.documentElement.boxObject.lastChild.firstChild);
			$("changesLogTitle").parentNode.setAttribute("align", "center");
			$("changesLogBox").setAttribute("window", true);
		}
		if ($("changesLogBox"))
		{
			if (storage("scrollTop") !== null)
			{
				$("changesLogBox").scrollTo(storage("scrollLeft"), storage("scrollTop"));
			}
			window.addEventListener("close", function close(e)
			{
				storage.delete("refresh");
				storage.delete("scrollTop");
				storage.delete("scrollLeft");
			}, false);
			window.addEventListener("unload", function unload(e)
			{
				storage("refresh", (new Date()).getTime());
				storage("scrollTop", $("changesLogBox").scrollTop);
				storage("scrollLeft", $("changesLogBox").scrollLeft);
/*
				changesLog.async(function()
				{
					try
					{
						storage.delete("scrollTop");
						storage.delete("scrollLeft");
						storage.delete("refresh");
					}catch(e){log(e)}
				}, 2000)
*/
			}, false)
		}
		changesLog.pref.clearUserPref("versionPrev");
	},//onload()

	unload: function unload(type)
	{
		storage.delete("refresh");
		storage.delete("scrollTop");
		storage.delete("scrollLeft");
	},

	RegExpEscape: function(string)
	{
		return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
	},

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

	getPrefs: function(type)
	{
		let l = this.pref.getChildList(""),
				r = {};
		l.sort();
		for (let i = 0; i < l.length; i++)
		{
			let s = l[i];
			if (/^template/.test(s))
				continue;

			switch(this.pref.getPrefType(s))
			{
				case Ci.nsIPrefBranch.PREF_BOOL:
					r[s] = this.pref.getBoolPref(s);
					break;
				case Ci.nsIPrefBranch.PREF_INT:
					r[s] = this.pref.getIntPref(s);
					break;
				case Ci.nsIPrefBranch.PREF_STRING:
					r[s] = this.prefString(this.pref, s);
/*
					if (/^template/.test(s))
						r[s] = r[s].replace(/\s{2,}/g, " ");
*/
					break;
			}
		}

		return r;
	},

	fixUrl: function(url)
	{
		let tags = {
					OSRAW: Services.appinfo.OS + " (" + Services.appinfo.XPCOMABI + ")",
					VERRAW: this.addon.version,
					APPRAW: Services.appinfo.name + " v" + Services.appinfo.version,
					EMAILRAW: this.decode(EMAIL),
					NAMERAW: this.addon.name,
					LOCALERAW: Cc["@mozilla.org/chrome/chrome-registry;1"].getService(Ci.nsIXULChromeRegistry).getSelectedLocale("global"),
					PREFSRAW: this.getPrefs(true),
					PREFSSERIALIZERAW: JSON.stringify(this.getPrefs(true))
				};
		tags.OS = encodeURIComponent(tags.OSRAW);
		tags.VER = encodeURIComponent(tags.VERRAW);
		tags.APP = encodeURIComponent(tags.APPRAW);
		tags.EMAIL = escape(tags.EMAILRAW);
		tags.NAME = encodeURIComponent(tags.NAMERAW);
		tags.LOCALE = encodeURIComponent(tags.LOCALERAW);
		tags.PREFS = encodeURIComponent(tags.PREFSRAW);
		tags.PREFSSERIALIZE = encodeURIComponent(tags.PREFSSERIALIZERAW);

		let reg = new RegExp("\{([A-Z]+)\}", "gm");
		url = url.replace(reg, function(a, b, c, d)
		{
			if (b in tags)
				return tags[b];
			return a;
		});
		return url;
	}, //fixUrl()

	init: function init()
	{
		try
		{
			storage.list = JSON.parse(storage.obj.getAttribute("value"));
		}
		catch(e){};
		let refresh = storage("refresh");
		if (!refresh)
		{
//collapse all versions after closing tab
//			storage.delete("v");
		}
		this.pref = Services.prefs.getBranch(PREF_BRANCH);
		let changesLogObj = $("changesLog"),
				aURL = this.addon.getResourceURI("changes.txt").spec,
				utf8Converter = Cc["@mozilla.org/intl/utf8converterservice;1"]
													.getService(Ci.nsIUTF8ConverterService),
				ioService = Cc["@mozilla.org/network/io-service;1"]
											.getService(Ci.nsIIOService),
				scriptableStream = Cc["@mozilla.org/scriptableinputstream;1"]
											.getService(Ci.nsIScriptableInputStream),
				channel,
				array,
				title,
				isChangesLog = window.location.href.indexOf("changes.xul") != -1,
				strings = Cc["@mozilla.org/intl/stringbundle;1"]
										.getService(Ci.nsIStringBundleService)
										.createBundle("chrome://" + ADDONDOMAIN + "/locale/main.properties"),
				_ = function(s)
				{
					try
					{
						return strings.GetStringFromName(s);
					}
					catch(e)
					{
						log([s, e]);
					}
				};
		try //WHAT THE FUCK, MOZILLA?! HOW ABOUT YOU UPDATE THE DAMN DOCUMENTATION BEFORE YOU REMOVE SHIT WITHOUT BACKWARDS COMPATIBILITY?
		{
			channel = ioService.newChannel2(aURL,null,null,
																			null,      // aLoadingNode
																			Services.scriptSecurityManager.getSystemPrincipal(),
																			null,      // aTriggeringPrincipal
																			Ci.nsILoadInfo.SEC_NORMAL,
																			Ci.nsIContentPolicy.TYPE_INTERNAL_IMAGE
			);
		}
		catch(e)
		{
			channel = ioService.newChannel(aURL,null,null);
		}
		this._ = _;
		this.rootWin =  window.QueryInterface(Ci.nsIInterfaceRequestor)
												.getInterface(Ci.nsIWebNavigation)
												.QueryInterface(Ci.nsIDocShellTreeItem)
												.rootTreeItem
												.QueryInterface(Ci.nsIInterfaceRequestor)
												.getInterface(Ci.nsIDOMWindow);
		this.rootDoc = this.rootWin.document;
		if ($("changeLogAddonOptions"))
		{
			$("changeLogAddonOptions").label = this.addon.name;
		}
		if ($("changesLogTitle"))
		{
			document.title = this.addon.name + " " + $("changesLogTitle").value;
			$("changesLogTitle").value = document.title;
		}
		if ($("changesLogCopyLink"))
		{
			$("changesLogCopyLink").setAttribute("label", _("menu_copy_url"));
			$("changesLogCopyLink").setAttribute("accesskey", _("menu_copy_url_key"));
			$("changesLogLinkCopy").setAttribute("label", _("menu_copy_url"));
		}
		let sup;
		sup = $("supportSite");
		if (sup)
		{
			sup.setAttribute("href", SUPPORTSITE + SUPPORTSITEQUERY);
			sup.setAttribute("link", SUPPORTSITE);
			sup.setAttribute("tooltiptext", SUPPORTSITE);
		}
		sup = $("supportHomepage");
		if (sup)
		{
			sup.setAttribute("href", HOMEPAGE);
			sup.setAttribute("link", HOMEPAGE);
			sup.setAttribute("tooltiptext", HOMEPAGE);
		}
		sup = $("supportEmail");
		if (sup)
		{
//			sup.setAttribute("href", this.fixUrl("mailto:{NAME} support<{EMAIL}>?subject={NAME}+support&body=%0A%0A_______%0AAddon:+{NAME}+v{VER}%0AOS:+{OS}%0AApp:+{APP}"));
			sup.setAttribute("link", this.fixUrl("{EMAIL}"));
			sup.setAttribute("linkCopy", this.fixUrl("{NAMERAW} support<{EMAILRAW}>"));
			sup.setAttribute("tooltiptext", this.fixUrl("{EMAIL}"));
			function promptExtList (e)
			{
				if (e.button == 2 || e.target.diabled)
					return;

				if (e.target.hasAttribute("href"))
				{
					e.target.removeAttribute("href");
					return false;
				}
				else
				{
					let promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService),
							button = promptService.confirmEx(window,
												_("addExtensionsTitle"),
												_("addExtensions"),
	//											promptService.BUTTON_POS_0 * promptService.BUTTON_TITLE_IS_STRING + promptService.BUTTON_POS_1 * promptService.BUTTON_TITLE_IS_STRING + promptService.BUTTON_POS_2 * promptService.BUTTON_TITLE_IS_STRING + promptService.BUTTON_POS_0_DEFAULT,
												promptService.BUTTON_POS_0 * promptService.BUTTON_TITLE_YES + promptService.BUTTON_POS_2 * promptService.BUTTON_TITLE_NO + promptService.BUTTON_POS_1 * promptService.BUTTON_TITLE_CANCEL + promptService.BUTTON_POS_0_DEFAULT,
												null,
												null,
												null,
												null,
												{});

					function callback(list, button)
					{
						let href = changesLog.fixUrl("mailto:{NAME} support<{EMAIL}>"),
								subject = changesLog.fixUrl("subject={NAME}"),
								body = changesLog.getEmailBody(list, button),
								extra = {};

						href += "?" + subject;
						if (!button)
							changesLog.copy(JSON.stringify(body, null));


						e.target.setAttribute("href", href);
						try
						{
							e.target.dispatchEvent(new window.MouseEvent('click', {
								'view': window,
								'bubbles': false,
								'cancelable': true
							}));
						}
						catch(err)
						{
							let evt = document.createEvent("MouseEvents");
							evt.initMouseEvent("click", true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null)
							e.target.dispatchEvent(evt);
						}
					}//else
					if (button == 2)
						callback([], button);
					else if (!button)
						AddonManager.getAllAddons(function(list)
						{
							callback(list, button)
						});

				}//promptExtList()
				e.stopPropagation();
				e.preventDefault();
			}
			sup.addEventListener("click", promptExtList, false);
		}
		sup = $("supportCopyInfo");
		if (sup)
		{
			sup.addEventListener("click", function(e)
			{
				if (e.button || e.target.disabled)
					return;

				AddonManager.getAllAddons(function(list)
				{
					changesLog.copy(JSON.stringify(changesLog.getEmailBody(list), null));
					window.alert(_("copied"));
				});
			}, false);
		}
		if (!isChangesLog)
			return;

		changesLogObj.setAttribute("highlight", $("changesLogHightlight").getAttribute("value"));
		changesLogObj.setAttribute("wrap", $("changesLogWrap").getAttribute("value"));
		let input = channel.open();
		scriptableStream.init(input);
		let str = scriptableStream.read(input.available());
		scriptableStream.close();
		input.close();
		str = utf8Converter.convertURISpecToUTF8 (str, "UTF-8");
		str = str.replace(/\t/g, "  ");
		title = str.substr(0, str.indexOf("\n"));
		str = str.replace(title, "").replace(/^\s+/g, "");
		array = str.split("\n");
		let prevhbox = null,
				prevhboxTitle = null,
				isLegend = true,
				legendBlockFound = false,
				legendBox = null,
				stats = {},
				typeString = {"-": "removed", "+": "added", "*": "changed", "!": "fixed", "#": "comment"};
		function showStats(stats)
		{
			let first = true,
					hboxStats = document.createElement("hbox"),
					legendType = $("changesLog").getAttribute("type") == "2";

			hboxStats.className = "stats";
			hboxStats.appendChild(document.createTextNode("\u00A0")); //add space
			let list = [];
			for(let i in stats)
			{
				list.push(i);
			}
			for(let c = 0; c < list.length; c++)
			{
				let i = list[c];
				let hbox = document.createElement("hbox"),
						type = document.createElement("description"),
						value = document.createElement("description"),
						coma = document.createElement("description"),
						type2 = document.createElement("description"),
						value2 = document.createElement("description");
				type.className = i;
				type2.className = i;
				value.className = i;
				value2.className = i;
				type.setAttribute("type", 0);
				type2.setAttribute("type", 1);
				value2.setAttribute("type", 1);
				type.appendChild(document.createTextNode(stats[i][0]));
				type2.appendChild(document.createTextNode(_(typeString[stats[i][0]])));
				value2.appendChild(document.createTextNode(":"));
				value.appendChild(value2);
				value.appendChild(document.createTextNode(stats[i][1]));
				coma.appendChild(document.createTextNode(c < list.length - 1 ? ", " : ""));
				hbox.appendChild(type);
				hbox.appendChild(type2);
				hbox.appendChild(value);
				hbox.appendChild(coma);
				hbox.setAttribute("line", "");
				hbox.className = i;
				hboxStats.appendChild(hbox);
			}
			return hboxStats;
		}

		let oddEven = 1,
				verBox = changesLogObj,
				prevVhash = window.location.hash.replace("#", ""),
				prevV = prevVhash,
				ver = storage("v") || {},
				compare = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator).compare;
		if (!prevV)
		{
			try
			{
				 prevV = this.pref.getCharPref("versionPrev").replace("-signed", "");
				 changesLog.prevVersion = prevV;
			}
			catch(e){}
		}
		for(let i = 0; i < array.length; i++)
		{
			let t = /^(\s*)([+\-*!#])/.exec(array[i]),
					tab = document.createElement("description"),
					type = document.createElement("description"),
					type2 = document.createElement("description"),
					label = document.createElement("description"),
					hbox = document.createElement("hbox"),
					vbox = document.createElement("vbox"),
					space = document.createElement("description"),
					isTitle = false,
					txt = 0;

			vbox.className = "text";
			hbox.setAttribute("flex", 0);
			vbox.setAttribute("flex", 1);
			type.className = "type";
			type2.className = "type";
			type.setAttribute("type", 0);
			type2.setAttribute("type", 1);
			tab.className = "tab";
			space.textContent = " ";
			if (t)
			{
				let s = typeString[t[2]] || "";
				if (t[2] != "#")
				{
					tab.textContent = t[1];
					type.textContent = t[2];
				}
				if (s)
				{
					if (t[2] != "#")
					{
						type2.textContent = _(s);
						if (typeof(stats[s]) == "undefined")
							stats[s] = [t[2], 0];

						stats[s][1]++;
					}
					hbox.setAttribute("oddeven", oddEven++ % 2); 
//						tab.className = s;
					type.className += " " + s;
					type2.className += " " + s;
					hbox.className = s;
				}
				hbox.appendChild(tab);
				hbox.appendChild(type);
				hbox.appendChild(type2);
				if (t[2] != "#")
					hbox.appendChild(space);

				txt = t[1].length + 1;
				if (t[1])
				{
					type.className += " border";
					type2.className += " border";
					tab.className += " border";
					label.className += " border";
				}
				if (!changesLog.firstBox)
					legendBlockFound = 1;
			}
			else if (array[i].match(/^v[0-9]+/))
			{
				verBox = document.createElement("vbox");
				let image = document.createElement("image"),
						imageBox = document.createElement("vbox"),
						lastBox = changesLogObj.lastChild;
				imageBox.setAttribute("pack", "center");
				imageBox.appendChild(image);
				hbox.id = array[i].match(/^([^\s]+)/)[1];
				hbox.addEventListener("click", function(e)
				{
					if (e.button && e.target != image)
						return false;

					if ((e.button && e.target == image) || e.detail > 1 || e.target == hbox)
					{
						if (imageBox._timer)
							imageBox._timer.cancel();

						e.stopPropagation();
						e.preventDefault();
						return false;
					}
					changesLog.showHideVersion(hbox, false)
				}, false)
//				hbox.setAttribute("persist", "hide");
				hbox.appendChild(imageBox);
				changesLogObj.appendChild(hbox);
				changesLogObj.appendChild(verBox);
				vbox.removeAttribute("flex");
				isTitle = true;
				if (isLegend || legendBlockFound > 1)
				{
					hbox.setAttribute("latest", true);
					hbox.setAttribute("hide", 0);
					changesLog.firstBox = hbox;
					if (legendBlockFound > 2)
						lastBox.previousSibling.className += " border";

					if (legendBox)
						legendBox.className += " border";
				}
				else
				{
					let version = (new RegExp("^v([0-9\\.a-z]+)" , "")).exec(array[i]);
					if (version)
					{
						version = version[1];
						if (prevV)
						{
							if (compare(version, prevV) > 0)
							{
								ver[hbox.id] = 0;
								hbox.setAttribute("hide", 0);
							}
							else
							{
								ver[hbox.id] = 1;
								hbox.setAttribute("hide", 1);
							}
							storage("v", ver);
						}
					}
				}
				isLegend = false;
				if (prevhboxTitle)
					prevhboxTitle.insertBefore(showStats(stats), prevhboxTitle.lastChild);

				prevhboxTitle = label;
				if (prevhbox)
				{
					prevhbox.className += " last";
					hbox.className = "titlelog";
				}
				else
				{
					prevhbox = true;
					hbox.className = "titlelog";
				}
				legendBlockFound = false;
				stats = {};
			}
			else
			{
				if (legendBlockFound && legendBlockFound++ > 1)
				{
					isLegend = false;
					label.className = "comment";
				}
			}
			if (array[i].length > 1 && prevhbox !== null)
				prevhbox = hbox;

			if (isLegend)
			{
				hbox.className += " legend";
				legendBox = hbox;
			}
			else
				hbox.setAttribute("line", "");

			let line = array[i].substr(txt).trim(),
					listIssue = [],
					regIssue = new RegExp("(^|[\\s,.;:\\(])(#([0-9" + (SOURCESITE ? "a-z]{1,40}" : "]+") + "))", "g"),
					issue,
					list = [];
			while(issue = regIssue.exec(line))
				listIssue.push(issue);

			if ((ISSUESSITE || SOURCESITE) && listIssue.length)
			{
				let start = 0;
				for(let i = 0; i < listIssue.length; i++)
				{
					let part = listIssue[i],
							end = part.index + part[1].length,
							text = line.substring(start, end),
							site = ISSUESSITE,
							ll;
					if (part[3].length > 3 && part[3].match(/[a-z]/))
						site = SOURCESITE;

					start = end + part[2].length;
					list.push(text);
					ll = document.createElement("label");
					ll.setAttribute("link", site + part[3]);
					ll.setAttribute("href", site + part[3]);
					ll.setAttribute("tooltiptext", site + part[3]);
					ll.addEventListener("mouseover", changesLog.mouseOver, true);
					ll.addEventListener("mouseout", changesLog.mouseOut, true);
					ll.className = "text-link link issue";
					ll.textContent = part[2];
					list.push(ll);
				}
				list.push(line.substr(start));
			}
			else
				list.push(line);
//				label.textContent = line;

			for(let i = 0; i < list.length; i++)
			{
				let list2 = [];
				if (typeof(list[i]) == "object")
					list2.push(list[i]);
				else
				{
					let line = list[i],
							listSetting = [],
//							regSetting = new RegExp("(" + this.RegExpEscape(PREF_BRANCH) + "[a-z0-9_\\-.]*)", "gi"),
							regSetting = new RegExp("(?:[\\s\\(])([a-z]\\w*\\.[a-z]\\w*\\.[a-z0-9_\\-.]*)", "gi"),
							setting;
					while(setting = regSetting.exec(line))
						listSetting.push({type: "config", data: setting});

//					regSetting = new RegExp("(\\(?(?:(?:https?|ftp):\/\/)((?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00A1-0-9]-*)*[a-z\u00A1-0-9]+)(?:\.(?:[a-z\u00A1-0-9]-*)*[a-z\u00A1-0-9]+)*(?:\.(?:[a-z\u00A1-]{2,}))\.?)(?::\d{2,5})?(?:[/?#]\S*)?)\\)?)", "gi");
 regSetting = new RegExp(
  "(\\(?" +
    // protocol identifier
    "(?:(?:https?|ftp)://)" +
    // user:pass authentication
    "((?:\\S+(?::\\S*)?@)?" +
    "(?:" +
      // IP address exclusion
      // private & local networks
      "(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
      "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
      "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +
      // IP address dotted notation octets
      // excludes loopback network 0.0.0.0
      // excludes reserved space >= 224.0.0.0
      // excludes network & broacast addresses
      // (first & last IP address of each class)
      "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
      "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
      "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
    "|" +
      // host name
      "(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)" +
      // domain name
      "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*" +
      // TLD identifier
      "(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))" +
    ")" +
    // port number
    "(?::\\d{2,5})?" +
    // resource path
    "(?:/\\S*)?)" +
  "\\)?)", "gi"
);

					while(setting = regSetting.exec(line))
						listSetting.push({type: "url", data: setting});

					if (listSetting.length)
					{
						let start = 0;
						for(let i = 0; i < listSetting.length; i++)
						{
							let part = listSetting[i].data,
									type = listSetting[i].type,
									end = part.index,
									text,
									url,
									urlText,
									link,
									c = "",
									ll = document.createElement("label");
							switch(type)
							{
								case "config":
									url = part[1];
									urlText = url;
									link = "about:config?filter=" + url;
									text = line.substring(start, end + 1);
									start = end + 1 + url.length;
									ll.addEventListener("click", function(e)
									{
										if (e.button == 2)
											return;

										let win = null;
										try
										{
											win = window.open(link);
										}
										catch(e)
										{
											if (coomanPlus.getOpenURL)
												win = coomanPlus.getOpenURL(link, true);
										}
										if (!win)
											return;
e.stopPropagation();
e.preventDefault();
										function setFilter(e)
										{
											win.document.getElementById("textbox").value = url;
										}
										if (win.document.readyState == "complete")
											setFilter()
										else
											win.addEventListener("load", function(e)
											{
												setFilter(e);
											}, false);
									}, true);

									c = " setting";
									break;
								case "url":
									url = part[1];
									urlText = part[2];
									if (url.substr(0, 1) == "(")
									{
										url = url.substr(1);
										end++;
									}
									if (url.substr(-1, 1) == ")")
									{
										url = url.substr(0, url.length - 1);
										if (urlText.substr(-1, 1) == ")")
											urlText = urlText.substr(0, urlText.length - 1);
									}
									link = url;
									text = line.substring(start, end);
									start = end + url.length;
									ll.setAttribute("href", link);
									break;
							}
							list2.push(document.createTextNode(text));
							ll.setAttribute("link", link);
							ll.addEventListener("mouseover", changesLog.mouseOver, true);
							ll.addEventListener("mouseout", changesLog.mouseOut, true);
							ll.className = "text-link link" + c;
							ll.textContent = urlText;
							list2.push(ll);
						}
						list2.push(document.createTextNode(line.substr(start)));
					}
					else
					{
						list2.push(document.createTextNode(list[i]));
					}
				}
				for(let i = 0; i < list2.length; i++)
				{
					label.appendChild(list2[i]);
				}
			}
			label.appendChild(document.createTextNode("\n"));
			vbox.appendChild(label)
			hbox.appendChild(vbox);
			if (!isTitle)
				verBox.appendChild(hbox);

//			if (i > 0)
//				verBox.appendChild(document.createTextNode("\n"));
		} //for array
		if (prevhboxTitle)
			prevhboxTitle.insertBefore(showStats(stats), prevhboxTitle.lastChild);

		changesLogObj.selectionStart = 0;
		changesLogObj.selectionEnd = 0;

		window.addEventListener("resize", this.onResize, true);
	}, //init()

	showHideVersion: function showHideVersion(hbox, type)
	{

		let ver = storage("v") || {},
				hide = hbox.hasAttribute("hide")
								? hbox.getAttribute("hide")
								: hbox.id in ver 
									? ver[hbox.id]
									: changesLog.checkboxGet("changesLogExpandAll") ^ 1;

		if (type === false)
			hide ^= 1;
		else if (type === true)
			hide = changesLog.checkboxGet("changesLogExpandAll") ^ 1;
		else if (typeof(type) != "undefined")
			hide = type;
		ver[hbox.id] = hide;
		storage("v", ver);
		hbox.setAttribute("hide", hide);
		return hide;
	},//showHideVersion()


	getEmailBody: function(list, noExtra)
	{
		let r = {
					Addon: changesLog.fixUrl("{NAMERAW} v{VERRAW}"),
					Program: changesLog.fixUrl("{APPRAW} ({LOCALERAW})"),
					OS: changesLog.fixUrl("{OSRAW}"),
					Preferences: changesLog.getPrefs(true)
				},
				extra = {};
		if (list.length && !noExtra)
		{
			for(let i in list)
			{
				if (list[i].isActive)
				{
					let type = list[i].type.charAt(0).toUpperCase() + list[i].type.slice(1);

					if (!extra[type])
						extra[type] = []

					extra[type].push([list[i].name, list[i].version,  list[i].id.replace(/@/g, "{a}")]);
				}
			}
		}
		if (!noExtra)
		{
			for(let i in extra)
				r[i] = extra[i];
		}
		return r;
	}//getEmailBody()
};//changesLog
AddonManager.getAddonByID(changesLog.GUID, function(addon)
{
	Services.scriptloader.loadSubScript(addon.getResourceURI("includes/constants.js").spec, self);
	changesLog.addon = addon;
	changesLog.init();
	changesLog.showLegendType();
	changesLog.showHighlight();
	changesLog.showWrap();
	changesLog.showAltbg();
	changesLog.showExpandAll();
	changesLog.checkboxGet("changesLogCopyIssueUrl");
});
Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService).addObserver(changesLog.unload, "quit-application", false);
})();
