import Reflux from "reflux";
import Color from "color";
import { themeActions } from "../actions";
import throttle from "lodash/function/throttle";
import defaultTheme from "../../data/theme.json";
import swatches from "../utils/swatches";

var Theme = Reflux.createStore({
  listenables: [themeActions],
  init() {
    this.styles = JSON.parse(localStorage.getItem("theme")) || defaultTheme;
  },
  getInitialState() {
    return this.styles;
  },
  changePaletteColor(hex, slot) {
    this.styles.palette[slot] = hex;
    this.styles = this.generateTargets(this.generateColors());
    this.trigger(this.styles);
  },
  generateColors() {
    let chosenColor = Color(this.styles.palette[0]);
    return {
      darkPrimary: chosenColor.darken(0.2).hexString(),
      primary: chosenColor.hexString(),
      lightPrimary: chosenColor.lighten(0.2).hexString(),
      verylightPrimary: chosenColor.lighten(0.4).hexString()
    };
  },
  generateTargets(c) {
    let darkUI = swatches.light.indexOf(this.styles.palette[0]) !== -1;
    return {
      darkUI: darkUI,
      colorPickerActive: false,
      palette: this.styles.palette,
      base: {
        btn: {
          borderColor: "#B6B6B6",
          color: "#B6B6B6"
        },
        btnPrimary: {
          borderColor: this.styles.palette[1],
          backgroundColor: this.styles.palette[1]
        }
      },
      header: {
        download: {
          backgroundColor: c.lightPrimary,
          color: darkUI ? "#121212" : "#fff"
        },
        titlebar: { backgroundColor: c.darkPrimary },
        h3: { color: darkUI ? "#121212" : "#fff" }
      },
      nav: {
        navbar: { backgroundColor: c.primary },
        tab: { color: darkUI ? "#121212" : "#fff" },
        tabActive: { backgroundColor: c.darkPrimary }
      },
      soundList: {
        item: { borderColor: "#B6B6B6" },
        itemPlaying: {
          color: darkUI ? "#121212" : "#fff",
          backgroundColor: c.lightPrimary
        },
        title: { color: !darkUI ? "#121212" : "#fff" },
        actions: { color: !darkUI ? "#121212" : "#fff" }
      }
    };
  }
});

Theme.listen(throttle(styles =>
  localStorage.setItem("theme", JSON.stringify(styles))
, 1000));

export default Theme;