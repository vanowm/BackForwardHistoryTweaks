var {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

var changesLog = {
	addon: null,
	PREF_BRANCH: PREF_BRANCH,
	pref: null,
	GUID: GUID,
	_copyIssueUrl: 0,
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
		changesLog.copy(document.popupNode.hasAttribute("linkCopy") ? document.popupNode.getAttribute("linkCopy") : document.popupNode.getAttribute("link"));
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
				if (this._copyIssueUrl && ISSUESSITE)
				{
					txt = txt.replace(/([ ,])(#([0-9]+))/g, function(a, b, c, d)
					{
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
			document.getElementById("changesLog").focus();
			sel.selectAllChildren(document.getElementById("changesLog"));
		}
	},

	popup: function(e)
	{
		let txt = window.getSelection().toString(),
				link = document.popupNode.hasAttribute("linkCopy") ? document.popupNode.getAttribute("linkCopy") : document.popupNode.getAttribute("link");
		if (txt)
			document.getElementById("changesLogCopy").removeAttribute("disabled");
		else
			document.getElementById("changesLogCopy").setAttribute("disabled", true);

		document.getElementById("changesLogCopy").collapsed = !txt && link;
		document.getElementById("changesLogCopyLink").collapsed = !link;
	},

	highlight: function(e)
	{
		let val = Number(document.getElementById("changesLogHightlight").getAttribute("value"))+1;
		if (val > 2 || val < 0)
			val = 0;
		document.getElementById("changesLogHightlight").setAttribute("value", val);
		this.showHighlight();
	},

	showHighlight: function()
	{
		let c = document.getElementById("changesLogHightlight");
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
		document.getElementById("changesLog").setAttribute("highlight", val)
	},

	legend: function(e)
	{
		let val = Number(document.getElementById("changesLogLegend").getAttribute("value"))+1;
		if (val > 1 || val < 0)
			val = 0;
		document.getElementById("changesLogLegend").setAttribute("value", val);
		this.showLegend();
	},

	showLegend: function()
	{
		let c = document.getElementById("changesLogLegend");
		let val = Number(c.getAttribute("value"));
		if (val == 1)
			c.setAttribute("checked", true);
		else
			c.removeAttribute("checked");

		document.getElementById("changesLog").setAttribute("legend", val)
	},

	wrap: function(e)
	{
		let val = Number(document.getElementById("changesLogWrap").getAttribute("value"))+1;
		if (val > 1 || val < 0)
			val = 0;

		document.getElementById("changesLogWrap").setAttribute("value", val);
		this.showWrap();
	},

	showWrap: function()
	{
		let c = document.getElementById("changesLogWrap"),
				b = document.getElementById("changesLog");
		let val = Number(c.getAttribute("value"));
		if (val == 1)
		{
			c.setAttribute("checked", true);
			b.setAttribute("flex", 1);
			b.parentNode.setAttribute("flex", 1);
		}
		else
		{
			c.removeAttribute("checked");
			b.setAttribute("flex", 0);
			b.parentNode.setAttribute("flex", 0);
		}
		document.getElementById("changesLog").setAttribute("wrap", val)
		this.onResize();
	},

	copyIssueUrl: function(e)
	{
		let val = Number(document.getElementById("changesLogCopyIssueUrl").getAttribute("value"))+1;
		if (val > 1 || val < 0)
			val = 0;
		document.getElementById("changesLogCopyIssueUrl").setAttribute("value", val);
		this.showCopyIssueUrl();
	},

	showCopyIssueUrl: function()
	{
		let c = document.getElementById("changesLogCopyIssueUrl");
		let val = Number(c.getAttribute("value"));
		if (val == 1)
			c.setAttribute("checked", true);
		else
			c.removeAttribute("checked");

		this._copyIssueUrl = val;
	},

	openOptions: function()
	{
		Services.wm.getMostRecentWindow('navigator:browser').BrowserOpenAddonsMgr("addons://detail/" + changesLog.addon.id + "/preferences");
	},

	onResize: function ()
	{
		let hbox = document.getElementsByAttribute("line", ""),
				height = document.getElementById("changesLogFirst");
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

	onload: function()
	{
		AddonManager.getAddonByID(changesLog.GUID, function(addon)
		{
			changesLog.addon = addon;
			changesLog.init();
		});
	},

	RegExpEscape: function(string)
	{
		return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
	},

	fixUrl: function(url)
	{
		let tags = {
					OS: encodeURIComponent(Services.appinfo.OS + " (" + Services.appinfo.XPCOMABI + ")"),
					VER: encodeURIComponent(this.addon.version),
					APP: encodeURIComponent(Services.appinfo.name + " v" + Services.appinfo.version),
					EMAIL: escape(this.decode(EMAIL)),
					EMAILRAW: this.decode(EMAIL),
					NAME: encodeURIComponent(this.addon.name),
					NAMERAW: this.addon.name
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

	init: function()
	{
		this.pref = Services.prefs.getBranch(this.PREF_BRANCH);
		let changesLogObj = document.getElementById("changesLog"),
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
				strings = Cc["@mozilla.org/intl/stringbundle;1"]
										.getService(Ci.nsIStringBundleService)
										.createBundle("chrome://" + ADDONDOMAIN + "/locale/main.properties"),
				_ = function(s)
				{
					return strings.GetStringFromName(s);
				};
		try
		{
			channel = ioService.newChannel(aURL,null,null);
		}
		catch(e) //WHAT THE FUCK, MOZILLA?! HOW ABOUT YOU UPDATE THE DAMN DOCUMENTATION BEFORE YOU REMOVE SHIT WITHOUT BACKWARDS COMPATIBILITY?
		{
			channel = ioService.newChannel2(aURL,null,null,
																			null,      // aLoadingNode
																			Services.scriptSecurityManager.getSystemPrincipal(),
																			null,      // aTriggeringPrincipal
																			Ci.nsILoadInfo.SEC_NORMAL,
																			Ci.nsIContentPolicy.TYPE_INTERNAL_IMAGE
			);
		}
		this._ = _;
		document.title = this.addon.name + " " + document.getElementById("changesLogTitle").value;
		document.getElementById("changesLogTitle").value = document.title;
		document.getElementById("changesLogCopyLink").setAttribute("label", _("menu_copy_url"));
		document.getElementById("changesLogCopyLink").setAttribute("accesskey", _("menu_copy_url_key"));
		document.getElementById("changesLogLinkCopy").setAttribute("label", _("menu_copy_url"));
		this.rootWin =  window.QueryInterface(Ci.nsIInterfaceRequestor)
												.getInterface(Ci.nsIWebNavigation)
												.QueryInterface(Ci.nsIDocShellTreeItem)
												.rootTreeItem
												.QueryInterface(Ci.nsIInterfaceRequestor)
												.getInterface(Ci.nsIDOMWindow);
		this.rootDoc = this.rootWin.document;
		let sup = document.getElementById("supportSite");
		sup.setAttribute("href", SUPPORTSITE);
		sup.setAttribute("link", SUPPORTSITE);
		sup.setAttribute("tooltiptext", SUPPORTSITE);
		sup = document.getElementById("supportHomepage");
		sup.setAttribute("href", HOMEPAGE);
		sup.setAttribute("link", HOMEPAGE);
		sup.setAttribute("tooltiptext", HOMEPAGE);
		sup = document.getElementById("supportEmail");
//		sup.setAttribute("href", this.fixUrl("mailto:{NAME} support<{EMAIL}>?subject={NAME}+support&body=%0A%0A_______%0AAddon:+{NAME}+v{VER}%0AOS:+{OS}%0AApp:+{APP}"));
		sup.setAttribute("link", this.fixUrl("{EMAIL}"));
		sup.setAttribute("linkCopy", this.fixUrl("{NAMERAW} support<{EMAILRAW}>"));
		sup.setAttribute("tooltiptext", this.fixUrl("{EMAIL}"));
		function promptExtList (e)
		{
			if (e.button == 2)
				return;

			if (e.target.hasAttribute("href"))
			{
				e.target.removeAttribute("href");
				return false;
			}
			else
			{
				let href = changesLog.fixUrl("mailto:{NAME} support<{EMAIL}>?subject={NAME}&body=%0A%0A__________%0A [Extension]%0A{NAME} v{VER}%0A%0A [Program]%0A{APP}%0A%0A [OS]%0A{OS}"),
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
		sup.addEventListener("click", promptExtList, false);


		changesLogObj.setAttribute("highlight", document.getElementById("changesLogHightlight").getAttribute("value"));
		changesLogObj.setAttribute("wrap", document.getElementById("changesLogWrap").getAttribute("value"));
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
				isLegend = true,
				legendBox = null;
		for(let i = 0; i < array.length; i++)
		{
			let t = /^(\s*)([+\-*!])/.exec(array[i]),
					tab = document.createElement("description"),
					type = document.createElement("description"),
					label = document.createElement("description"),
					hbox = document.createElement("hbox"),
					vbox = document.createElement("vbox"),
					space = document.createElement("description"),
					txt = 0;
			if (i > 0)
				changesLogObj.appendChild(document.createTextNode("\n"));

			vbox.className = "text";
			hbox.setAttribute("flex", 0);
			vbox.setAttribute("flex", 1);
			type.className = "type";
			tab.className = "tab";
			space.textContent = " ";
			if (t)
			{
				tab.textContent = t[1];
				type.textContent = t[2];
				let s = "";
				switch(t[2])
				{
					case "+":
						s = "added";
						break;
					case "-":
						s = "removed";
						break;
					case "!":
						s = "fixed";
						break;
					case "*":
						s = "changed";
						break;
				}
				if (s)
				{
//						tab.className = s;
					type.className += " " + s;
					hbox.className = s;
				}
				hbox.appendChild(tab);
				hbox.appendChild(type);
				hbox.appendChild(space);
				txt = t[1].length + 1;
				if (t[1])
				{
					type.className += " border";
					tab.className += " border";
					label.className += " border";
				}
			}
			else if (array[i].match(/^v[0-9]+/))
			{
				if (isLegend)
				{
					hbox.id = "changesLogFirst";
					if (legendBox)
						legendBox.className += " border";
				}

				isLegend = false;
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
					regIssue = /([ ,])(#([0-9]+))/g,
					issue,
					list = [];

			while(issue = regIssue.exec(line))
				listIssue.push(issue);

			if (ISSUESSITE && listIssue.length)
			{
				let start = 0;
				for(let i = 0; i < listIssue.length; i++)
				{
					let part = listIssue[i],
							end = part.index + part[1].length,
							text = line.substring(start, end),
							ll;
					start = end + part[2].length;
					list.push(text);
					ll = document.createElement("label");
					ll.setAttribute("link", ISSUESSITE + part[3]);
					ll.setAttribute("href", ISSUESSITE + part[3]);
					ll.setAttribute("tooltiptext", ISSUESSITE + part[3]);
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

			let list2 = [];
			for(let i = 0; i < list.length; i++)
			{
				if (typeof(list[i]) == "object")
					list2.push(list[i]);
				else
				{
					let line = list[i],
							listSetting = [],
							regSetting = new RegExp("(setting )(" + this.RegExpEscape(this.PREF_BRANCH) + "[a-z0-9_\\-.]*)", "gi"),
							setting;

					while(setting = regSetting.exec(line))
						listSetting.push(setting);

					if (listSetting.length)
					{
						let start = 0;
						for(let i = 0; i < listSetting.length; i++)
						{
							let part = listSetting[i],
									end = part.index + part[1].length,
									text = line.substring(start, end),
									ll;
							start = end + part[2].length;
							ll = document.createElement("description");
							ll.textContent = text;
							list2.push(ll);
							ll = document.createElement("label");
							ll.setAttribute("link", "about:config?filter=" + part[2]);
							ll.addEventListener("mouseover", changesLog.mouseOver, true);
							ll.addEventListener("mouseout", changesLog.mouseOut, true);
							ll.addEventListener("click", function(e)
							{
								if (e.button != 2)
									window.open(e.target.getAttribute('link'));
							}, true);
							ll.className = "text-link link setting";
							ll.textContent = part[2];
							list2.push(ll);
						}
						ll = document.createElement("description");
						ll.textContent = line.substr(start);
						list2.push(ll);
					}
					else
					{
						let l = document.createElement("description");
						l.textContent = list[i];
						list2.push(l);
					}
				}
			}
			for(let i = 0; i < list2.length; i++)
			{
				label.appendChild(list2[i]);
			}
			label.appendChild(document.createTextNode("\n"));
			vbox.appendChild(label)
			hbox.appendChild(vbox);
			changesLogObj.appendChild(hbox);
		}
		changesLogObj.selectionStart = 0;
		changesLogObj.selectionEnd = 0;
		if (!("arguments" in window) || !window.arguments)
			document.documentElement._buttons.accept.hidden = true;
		else
		{
			document.documentElement.boxObject.lastChild.insertBefore(document.getElementById("changesLogSupport"), document.documentElement.boxObject.lastChild.firstChild);
			document.getElementById("changesLogTitle").parentNode.setAttribute("align", "center");
			document.getElementById("changesLogBox").setAttribute("window", true);
		}

		this.showLegend();
		this.showHighlight();
		this.showWrap();
		this.showCopyIssueUrl();
		window.addEventListener("resize", this.onResize, true);
	} //init()
};