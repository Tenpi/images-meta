(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global['images-meta'] = {})));
}(this, (function (exports) { 'use strict';

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var piexif = createCommonjsModule(function (module, exports) {
	  /* piexifjs
	  
	  The MIT License (MIT)
	  
	  Copyright (c) 2014, 2015 hMatoba(https://github.com/hMatoba)
	  
	  Permission is hereby granted, free of charge, to any person obtaining a copy
	  of this software and associated documentation files (the "Software"), to deal
	  in the Software without restriction, including without limitation the rights
	  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	  copies of the Software, and to permit persons to whom the Software is
	  furnished to do so, subject to the following conditions:
	  
	  The above copyright notice and this permission notice shall be included in all
	  copies or substantial portions of the Software.
	  
	  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	  SOFTWARE.
	  */
	  (function () {

	    var that = {};
	    that.version = "1.0.4";

	    that.remove = function (jpeg) {
	      var b64 = false;

	      if (jpeg.slice(0, 2) == "\xff\xd8") ; else if (jpeg.slice(0, 23) == "data:image/jpeg;base64," || jpeg.slice(0, 22) == "data:image/jpg;base64,") {
	        jpeg = atob(jpeg.split(",")[1]);
	        b64 = true;
	      } else {
	        throw new Error("Given data is not jpeg.");
	      }

	      var segments = splitIntoSegments(jpeg);
	      var newSegments = segments.filter(function (seg) {
	        return !(seg.slice(0, 2) == "\xff\xe1" && seg.slice(4, 10) == "Exif\x00\x00");
	      });
	      var new_data = newSegments.join("");

	      if (b64) {
	        new_data = "data:image/jpeg;base64," + btoa(new_data);
	      }

	      return new_data;
	    };

	    that.insert = function (exif, jpeg) {
	      var b64 = false;

	      if (exif.slice(0, 6) != "\x45\x78\x69\x66\x00\x00") {
	        throw new Error("Given data is not exif.");
	      }

	      if (jpeg.slice(0, 2) == "\xff\xd8") ; else if (jpeg.slice(0, 23) == "data:image/jpeg;base64," || jpeg.slice(0, 22) == "data:image/jpg;base64,") {
	        jpeg = atob(jpeg.split(",")[1]);
	        b64 = true;
	      } else {
	        throw new Error("Given data is not jpeg.");
	      }

	      var exifStr = "\xff\xe1" + pack(">H", [exif.length + 2]) + exif;
	      var segments = splitIntoSegments(jpeg);
	      var new_data = mergeSegments(segments, exifStr);

	      if (b64) {
	        new_data = "data:image/jpeg;base64," + btoa(new_data);
	      }

	      return new_data;
	    };

	    that.load = function (data) {
	      var input_data;

	      if (typeof data == "string") {
	        if (data.slice(0, 2) == "\xff\xd8") {
	          input_data = data;
	        } else if (data.slice(0, 23) == "data:image/jpeg;base64," || data.slice(0, 22) == "data:image/jpg;base64,") {
	          input_data = atob(data.split(",")[1]);
	        } else if (data.slice(0, 4) == "Exif") {
	          input_data = data.slice(6);
	        } else {
	          throw new Error("'load' gots invalid file data.");
	        }
	      } else {
	        throw new Error("'load' gots invalid type argument.");
	      }
	      var exif_dict = {
	        "0th": {},
	        "Exif": {},
	        "GPS": {},
	        "Interop": {},
	        "1st": {},
	        "thumbnail": null
	      };
	      var exifReader = new ExifReader(input_data);

	      if (exifReader.tiftag === null) {
	        return exif_dict;
	      }

	      if (exifReader.tiftag.slice(0, 2) == "\x49\x49") {
	        exifReader.endian_mark = "<";
	      } else {
	        exifReader.endian_mark = ">";
	      }

	      var pointer = unpack(exifReader.endian_mark + "L", exifReader.tiftag.slice(4, 8))[0];
	      exif_dict["0th"] = exifReader.get_ifd(pointer, "0th");
	      var first_ifd_pointer = exif_dict["0th"]["first_ifd_pointer"];
	      delete exif_dict["0th"]["first_ifd_pointer"];

	      if (34665 in exif_dict["0th"]) {
	        pointer = exif_dict["0th"][34665];
	        exif_dict["Exif"] = exifReader.get_ifd(pointer, "Exif");
	      }

	      if (34853 in exif_dict["0th"]) {
	        pointer = exif_dict["0th"][34853];
	        exif_dict["GPS"] = exifReader.get_ifd(pointer, "GPS");
	      }

	      if (40965 in exif_dict["Exif"]) {
	        pointer = exif_dict["Exif"][40965];
	        exif_dict["Interop"] = exifReader.get_ifd(pointer, "Interop");
	      }

	      if (first_ifd_pointer != "\x00\x00\x00\x00") {
	        pointer = unpack(exifReader.endian_mark + "L", first_ifd_pointer)[0];
	        exif_dict["1st"] = exifReader.get_ifd(pointer, "1st");

	        if (513 in exif_dict["1st"] && 514 in exif_dict["1st"]) {
	          var end = exif_dict["1st"][513] + exif_dict["1st"][514];
	          var thumb = exifReader.tiftag.slice(exif_dict["1st"][513], end);
	          exif_dict["thumbnail"] = thumb;
	        }
	      }

	      return exif_dict;
	    };

	    that.dump = function (exif_dict_original) {
	      var TIFF_HEADER_LENGTH = 8;
	      var exif_dict = copy(exif_dict_original);
	      var header = "Exif\x00\x00\x4d\x4d\x00\x2a\x00\x00\x00\x08";
	      var exif_is = false;
	      var gps_is = false;
	      var interop_is = false;
	      var first_is = false;
	      var zeroth_ifd, exif_ifd, interop_ifd, gps_ifd, first_ifd;

	      if ("0th" in exif_dict) {
	        zeroth_ifd = exif_dict["0th"];
	      } else {
	        zeroth_ifd = {};
	      }

	      if ("Exif" in exif_dict && Object.keys(exif_dict["Exif"]).length || "Interop" in exif_dict && Object.keys(exif_dict["Interop"]).length) {
	        zeroth_ifd[34665] = 1;
	        exif_is = true;
	        exif_ifd = exif_dict["Exif"];

	        if ("Interop" in exif_dict && Object.keys(exif_dict["Interop"]).length) {
	          exif_ifd[40965] = 1;
	          interop_is = true;
	          interop_ifd = exif_dict["Interop"];
	        } else if (Object.keys(exif_ifd).indexOf(that.ExifIFD.InteroperabilityTag.toString()) > -1) {
	          delete exif_ifd[40965];
	        }
	      } else if (Object.keys(zeroth_ifd).indexOf(that.ImageIFD.ExifTag.toString()) > -1) {
	        delete zeroth_ifd[34665];
	      }

	      if ("GPS" in exif_dict && Object.keys(exif_dict["GPS"]).length) {
	        zeroth_ifd[that.ImageIFD.GPSTag] = 1;
	        gps_is = true;
	        gps_ifd = exif_dict["GPS"];
	      } else if (Object.keys(zeroth_ifd).indexOf(that.ImageIFD.GPSTag.toString()) > -1) {
	        delete zeroth_ifd[that.ImageIFD.GPSTag];
	      }

	      if ("1st" in exif_dict && "thumbnail" in exif_dict && exif_dict["thumbnail"] != null) {
	        first_is = true;
	        exif_dict["1st"][513] = 1;
	        exif_dict["1st"][514] = 1;
	        first_ifd = exif_dict["1st"];
	      }

	      var zeroth_set = _dict_to_bytes(zeroth_ifd, "0th", 0);

	      var zeroth_length = zeroth_set[0].length + exif_is * 12 + gps_is * 12 + 4 + zeroth_set[1].length;
	      var exif_set,
	          exif_bytes = "",
	          exif_length = 0,
	          gps_set,
	          gps_bytes = "",
	          gps_length = 0,
	          interop_set,
	          interop_bytes = "",
	          interop_length = 0,
	          first_set,
	          first_bytes = "",
	          thumbnail;

	      if (exif_is) {
	        exif_set = _dict_to_bytes(exif_ifd, "Exif", zeroth_length);
	        exif_length = exif_set[0].length + interop_is * 12 + exif_set[1].length;
	      }

	      if (gps_is) {
	        gps_set = _dict_to_bytes(gps_ifd, "GPS", zeroth_length + exif_length);
	        gps_bytes = gps_set.join("");
	        gps_length = gps_bytes.length;
	      }

	      if (interop_is) {
	        var offset = zeroth_length + exif_length + gps_length;
	        interop_set = _dict_to_bytes(interop_ifd, "Interop", offset);
	        interop_bytes = interop_set.join("");
	        interop_length = interop_bytes.length;
	      }

	      if (first_is) {
	        var offset = zeroth_length + exif_length + gps_length + interop_length;
	        first_set = _dict_to_bytes(first_ifd, "1st", offset);
	        thumbnail = _get_thumbnail(exif_dict["thumbnail"]);

	        if (thumbnail.length > 64000) {
	          throw new Error("Given thumbnail is too large. max 64kB");
	        }
	      }

	      var exif_pointer = "",
	          gps_pointer = "",
	          interop_pointer = "",
	          first_ifd_pointer = "\x00\x00\x00\x00";

	      if (exif_is) {
	        var pointer_value = TIFF_HEADER_LENGTH + zeroth_length;
	        var pointer_str = pack(">L", [pointer_value]);
	        var key = 34665;
	        var key_str = pack(">H", [key]);
	        var type_str = pack(">H", [TYPES["Long"]]);
	        var length_str = pack(">L", [1]);
	        exif_pointer = key_str + type_str + length_str + pointer_str;
	      }

	      if (gps_is) {
	        var pointer_value = TIFF_HEADER_LENGTH + zeroth_length + exif_length;
	        var pointer_str = pack(">L", [pointer_value]);
	        var key = 34853;
	        var key_str = pack(">H", [key]);
	        var type_str = pack(">H", [TYPES["Long"]]);
	        var length_str = pack(">L", [1]);
	        gps_pointer = key_str + type_str + length_str + pointer_str;
	      }

	      if (interop_is) {
	        var pointer_value = TIFF_HEADER_LENGTH + zeroth_length + exif_length + gps_length;
	        var pointer_str = pack(">L", [pointer_value]);
	        var key = 40965;
	        var key_str = pack(">H", [key]);
	        var type_str = pack(">H", [TYPES["Long"]]);
	        var length_str = pack(">L", [1]);
	        interop_pointer = key_str + type_str + length_str + pointer_str;
	      }

	      if (first_is) {
	        var pointer_value = TIFF_HEADER_LENGTH + zeroth_length + exif_length + gps_length + interop_length;
	        first_ifd_pointer = pack(">L", [pointer_value]);
	        var thumbnail_pointer = pointer_value + first_set[0].length + 24 + 4 + first_set[1].length;
	        var thumbnail_p_bytes = "\x02\x01\x00\x04\x00\x00\x00\x01" + pack(">L", [thumbnail_pointer]);
	        var thumbnail_length_bytes = "\x02\x02\x00\x04\x00\x00\x00\x01" + pack(">L", [thumbnail.length]);
	        first_bytes = first_set[0] + thumbnail_p_bytes + thumbnail_length_bytes + "\x00\x00\x00\x00" + first_set[1] + thumbnail;
	      }

	      var zeroth_bytes = zeroth_set[0] + exif_pointer + gps_pointer + first_ifd_pointer + zeroth_set[1];

	      if (exif_is) {
	        exif_bytes = exif_set[0] + interop_pointer + exif_set[1];
	      }

	      return header + zeroth_bytes + exif_bytes + gps_bytes + interop_bytes + first_bytes;
	    };

	    function copy(obj) {
	      return JSON.parse(JSON.stringify(obj));
	    }

	    function _get_thumbnail(jpeg) {
	      var segments = splitIntoSegments(jpeg);

	      while ("\xff\xe0" <= segments[1].slice(0, 2) && segments[1].slice(0, 2) <= "\xff\xef") {
	        segments = [segments[0]].concat(segments.slice(2));
	      }

	      return segments.join("");
	    }

	    function _pack_byte(array) {
	      return pack(">" + nStr("B", array.length), array);
	    }

	    function _pack_short(array) {
	      return pack(">" + nStr("H", array.length), array);
	    }

	    function _pack_long(array) {
	      return pack(">" + nStr("L", array.length), array);
	    }

	    function _value_to_bytes(raw_value, value_type, offset) {
	      var four_bytes_over = "";
	      var value_str = "";
	      var length, new_value, num, den;

	      if (value_type == "Byte") {
	        length = raw_value.length;

	        if (length <= 4) {
	          value_str = _pack_byte(raw_value) + nStr("\x00", 4 - length);
	        } else {
	          value_str = pack(">L", [offset]);
	          four_bytes_over = _pack_byte(raw_value);
	        }
	      } else if (value_type == "Short") {
	        length = raw_value.length;

	        if (length <= 2) {
	          value_str = _pack_short(raw_value) + nStr("\x00\x00", 2 - length);
	        } else {
	          value_str = pack(">L", [offset]);
	          four_bytes_over = _pack_short(raw_value);
	        }
	      } else if (value_type == "Long") {
	        length = raw_value.length;

	        if (length <= 1) {
	          value_str = _pack_long(raw_value);
	        } else {
	          value_str = pack(">L", [offset]);
	          four_bytes_over = _pack_long(raw_value);
	        }
	      } else if (value_type == "Ascii") {
	        new_value = raw_value + "\x00";
	        length = new_value.length;

	        if (length > 4) {
	          value_str = pack(">L", [offset]);
	          four_bytes_over = new_value;
	        } else {
	          value_str = new_value + nStr("\x00", 4 - length);
	        }
	      } else if (value_type == "Rational") {
	        if (typeof raw_value[0] == "number") {
	          length = 1;
	          num = raw_value[0];
	          den = raw_value[1];
	          new_value = pack(">L", [num]) + pack(">L", [den]);
	        } else {
	          length = raw_value.length;
	          new_value = "";

	          for (var n = 0; n < length; n++) {
	            num = raw_value[n][0];
	            den = raw_value[n][1];
	            new_value += pack(">L", [num]) + pack(">L", [den]);
	          }
	        }

	        value_str = pack(">L", [offset]);
	        four_bytes_over = new_value;
	      } else if (value_type == "SRational") {
	        if (typeof raw_value[0] == "number") {
	          length = 1;
	          num = raw_value[0];
	          den = raw_value[1];
	          new_value = pack(">l", [num]) + pack(">l", [den]);
	        } else {
	          length = raw_value.length;
	          new_value = "";

	          for (var n = 0; n < length; n++) {
	            num = raw_value[n][0];
	            den = raw_value[n][1];
	            new_value += pack(">l", [num]) + pack(">l", [den]);
	          }
	        }

	        value_str = pack(">L", [offset]);
	        four_bytes_over = new_value;
	      } else if (value_type == "Undefined") {
	        length = raw_value.length;

	        if (length > 4) {
	          value_str = pack(">L", [offset]);
	          four_bytes_over = raw_value;
	        } else {
	          value_str = raw_value + nStr("\x00", 4 - length);
	        }
	      }

	      var length_str = pack(">L", [length]);
	      return [length_str, value_str, four_bytes_over];
	    }

	    function _dict_to_bytes(ifd_dict, ifd, ifd_offset) {
	      var TIFF_HEADER_LENGTH = 8;
	      var tag_count = Object.keys(ifd_dict).length;
	      var entry_header = pack(">H", [tag_count]);
	      var entries_length;

	      if (["0th", "1st"].indexOf(ifd) > -1) {
	        entries_length = 2 + tag_count * 12 + 4;
	      } else {
	        entries_length = 2 + tag_count * 12;
	      }

	      var entries = "";
	      var values = "";
	      var key;

	      for (var key in ifd_dict) {
	        if (typeof key == "string") {
	          key = parseInt(key);
	        }

	        if (ifd == "0th" && [34665, 34853].indexOf(key) > -1) {
	          continue;
	        } else if (ifd == "Exif" && key == 40965) {
	          continue;
	        } else if (ifd == "1st" && [513, 514].indexOf(key) > -1) {
	          continue;
	        }

	        var raw_value = ifd_dict[key];
	        var key_str = pack(">H", [key]);
	        var value_type = TAGS[ifd][key]["type"];
	        var type_str = pack(">H", [TYPES[value_type]]);

	        if (typeof raw_value == "number") {
	          raw_value = [raw_value];
	        }

	        var offset = TIFF_HEADER_LENGTH + entries_length + ifd_offset + values.length;

	        var b = _value_to_bytes(raw_value, value_type, offset);

	        var length_str = b[0];
	        var value_str = b[1];
	        var four_bytes_over = b[2];
	        entries += key_str + type_str + length_str + value_str;
	        values += four_bytes_over;
	      }

	      return [entry_header + entries, values];
	    }

	    function ExifReader(data) {
	      var segments, app1;

	      if (data.slice(0, 2) == "\xff\xd8") {
	        // JPEG
	        segments = splitIntoSegments(data);
	        app1 = getExifSeg(segments);

	        if (app1) {
	          this.tiftag = app1.slice(10);
	        } else {
	          this.tiftag = null;
	        }
	      } else if (["\x49\x49", "\x4d\x4d"].indexOf(data.slice(0, 2)) > -1) {
	        // TIFF
	        this.tiftag = data;
	      } else if (data.slice(0, 4) == "Exif") {
	        // Exif
	        this.tiftag = data.slice(6);
	      } else {
	        throw new Error("Given file is neither JPEG nor TIFF.");
	      }
	    }

	    ExifReader.prototype = {
	      get_ifd: function get_ifd(pointer, ifd_name) {
	        var ifd_dict = {};
	        var tag_count = unpack(this.endian_mark + "H", this.tiftag.slice(pointer, pointer + 2))[0];
	        var offset = pointer + 2;
	        var t;

	        if (["0th", "1st"].indexOf(ifd_name) > -1) {
	          t = "Image";
	        } else {
	          t = ifd_name;
	        }

	        for (var x = 0; x < tag_count; x++) {
	          pointer = offset + 12 * x;
	          var tag = unpack(this.endian_mark + "H", this.tiftag.slice(pointer, pointer + 2))[0];
	          var value_type = unpack(this.endian_mark + "H", this.tiftag.slice(pointer + 2, pointer + 4))[0];
	          var value_num = unpack(this.endian_mark + "L", this.tiftag.slice(pointer + 4, pointer + 8))[0];
	          var value = this.tiftag.slice(pointer + 8, pointer + 12);
	          var v_set = [value_type, value_num, value];

	          if (tag in TAGS[t]) {
	            ifd_dict[tag] = this.convert_value(v_set);
	          }
	        }

	        if (ifd_name == "0th") {
	          pointer = offset + 12 * tag_count;
	          ifd_dict["first_ifd_pointer"] = this.tiftag.slice(pointer, pointer + 4);
	        }

	        return ifd_dict;
	      },
	      convert_value: function convert_value(val) {
	        var data = null;
	        var t = val[0];
	        var length = val[1];
	        var value = val[2];
	        var pointer;

	        if (t == 1) {
	          // BYTE
	          if (length > 4) {
	            pointer = unpack(this.endian_mark + "L", value)[0];
	            data = unpack(this.endian_mark + nStr("B", length), this.tiftag.slice(pointer, pointer + length));
	          } else {
	            data = unpack(this.endian_mark + nStr("B", length), value.slice(0, length));
	          }
	        } else if (t == 2) {
	          // ASCII
	          if (length > 4) {
	            pointer = unpack(this.endian_mark + "L", value)[0];
	            data = this.tiftag.slice(pointer, pointer + length - 1);
	          } else {
	            data = value.slice(0, length - 1);
	          }
	        } else if (t == 3) {
	          // SHORT
	          if (length > 2) {
	            pointer = unpack(this.endian_mark + "L", value)[0];
	            data = unpack(this.endian_mark + nStr("H", length), this.tiftag.slice(pointer, pointer + length * 2));
	          } else {
	            data = unpack(this.endian_mark + nStr("H", length), value.slice(0, length * 2));
	          }
	        } else if (t == 4) {
	          // LONG
	          if (length > 1) {
	            pointer = unpack(this.endian_mark + "L", value)[0];
	            data = unpack(this.endian_mark + nStr("L", length), this.tiftag.slice(pointer, pointer + length * 4));
	          } else {
	            data = unpack(this.endian_mark + nStr("L", length), value);
	          }
	        } else if (t == 5) {
	          // RATIONAL
	          pointer = unpack(this.endian_mark + "L", value)[0];

	          if (length > 1) {
	            data = [];

	            for (var x = 0; x < length; x++) {
	              data.push([unpack(this.endian_mark + "L", this.tiftag.slice(pointer + x * 8, pointer + 4 + x * 8))[0], unpack(this.endian_mark + "L", this.tiftag.slice(pointer + 4 + x * 8, pointer + 8 + x * 8))[0]]);
	            }
	          } else {
	            data = [unpack(this.endian_mark + "L", this.tiftag.slice(pointer, pointer + 4))[0], unpack(this.endian_mark + "L", this.tiftag.slice(pointer + 4, pointer + 8))[0]];
	          }
	        } else if (t == 7) {
	          // UNDEFINED BYTES
	          if (length > 4) {
	            pointer = unpack(this.endian_mark + "L", value)[0];
	            data = this.tiftag.slice(pointer, pointer + length);
	          } else {
	            data = value.slice(0, length);
	          }
	        } else if (t == 9) {
	          // SLONG
	          if (length > 1) {
	            pointer = unpack(this.endian_mark + "L", value)[0];
	            data = unpack(this.endian_mark + nStr("l", length), this.tiftag.slice(pointer, pointer + length * 4));
	          } else {
	            data = unpack(this.endian_mark + nStr("l", length), value);
	          }
	        } else if (t == 10) {
	          // SRATIONAL
	          pointer = unpack(this.endian_mark + "L", value)[0];

	          if (length > 1) {
	            data = [];

	            for (var x = 0; x < length; x++) {
	              data.push([unpack(this.endian_mark + "l", this.tiftag.slice(pointer + x * 8, pointer + 4 + x * 8))[0], unpack(this.endian_mark + "l", this.tiftag.slice(pointer + 4 + x * 8, pointer + 8 + x * 8))[0]]);
	            }
	          } else {
	            data = [unpack(this.endian_mark + "l", this.tiftag.slice(pointer, pointer + 4))[0], unpack(this.endian_mark + "l", this.tiftag.slice(pointer + 4, pointer + 8))[0]];
	          }
	        } else {
	          throw new Error("Exif might be wrong. Got incorrect value " + "type to decode. type:" + t);
	        }

	        if (data instanceof Array && data.length == 1) {
	          return data[0];
	        } else {
	          return data;
	        }
	      }
	    };

	    if (typeof window !== "undefined" && typeof window.btoa === "function") {
	      var btoa = window.btoa;
	    }

	    if (typeof btoa === "undefined") {
	      var btoa = function btoa(input) {
	        var output = "";
	        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
	        var i = 0;
	        var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

	        while (i < input.length) {
	          chr1 = input.charCodeAt(i++);
	          chr2 = input.charCodeAt(i++);
	          chr3 = input.charCodeAt(i++);
	          enc1 = chr1 >> 2;
	          enc2 = (chr1 & 3) << 4 | chr2 >> 4;
	          enc3 = (chr2 & 15) << 2 | chr3 >> 6;
	          enc4 = chr3 & 63;

	          if (isNaN(chr2)) {
	            enc3 = enc4 = 64;
	          } else if (isNaN(chr3)) {
	            enc4 = 64;
	          }

	          output = output + keyStr.charAt(enc1) + keyStr.charAt(enc2) + keyStr.charAt(enc3) + keyStr.charAt(enc4);
	        }

	        return output;
	      };
	    }

	    if (typeof window !== "undefined" && typeof window.atob === "function") {
	      var atob = window.atob;
	    }

	    if (typeof atob === "undefined") {
	      var atob = function atob(input) {
	        var output = "";
	        var chr1, chr2, chr3;
	        var enc1, enc2, enc3, enc4;
	        var i = 0;
	        var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
	        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

	        while (i < input.length) {
	          enc1 = keyStr.indexOf(input.charAt(i++));
	          enc2 = keyStr.indexOf(input.charAt(i++));
	          enc3 = keyStr.indexOf(input.charAt(i++));
	          enc4 = keyStr.indexOf(input.charAt(i++));
	          chr1 = enc1 << 2 | enc2 >> 4;
	          chr2 = (enc2 & 15) << 4 | enc3 >> 2;
	          chr3 = (enc3 & 3) << 6 | enc4;
	          output = output + String.fromCharCode(chr1);

	          if (enc3 != 64) {
	            output = output + String.fromCharCode(chr2);
	          }

	          if (enc4 != 64) {
	            output = output + String.fromCharCode(chr3);
	          }
	        }

	        return output;
	      };
	    }

	    function pack(mark, array) {
	      if (!(array instanceof Array)) {
	        throw new Error("'pack' error. Got invalid type argument.");
	      }

	      if (mark.length - 1 != array.length) {
	        throw new Error("'pack' error. " + (mark.length - 1) + " marks, " + array.length + " elements.");
	      }

	      var littleEndian;

	      if (mark[0] == "<") {
	        littleEndian = true;
	      } else if (mark[0] == ">") {
	        littleEndian = false;
	      } else {
	        throw new Error("");
	      }

	      var packed = "";
	      var p = 1;
	      var val = null;
	      var c = null;
	      var valStr = null;

	      while (c = mark[p]) {
	        if (c.toLowerCase() == "b") {
	          val = array[p - 1];

	          if (c == "b" && val < 0) {
	            val += 0x100;
	          }

	          if (val > 0xff || val < 0) {
	            throw new Error("'pack' error.");
	          } else {
	            valStr = String.fromCharCode(val);
	          }
	        } else if (c == "H") {
	          val = array[p - 1];

	          if (val > 0xffff || val < 0) {
	            throw new Error("'pack' error.");
	          } else {
	            valStr = String.fromCharCode(Math.floor(val % 0x10000 / 0x100)) + String.fromCharCode(val % 0x100);

	            if (littleEndian) {
	              valStr = valStr.split("").reverse().join("");
	            }
	          }
	        } else if (c.toLowerCase() == "l") {
	          val = array[p - 1];

	          if (c == "l" && val < 0) {
	            val += 0x100000000;
	          }

	          if (val > 0xffffffff || val < 0) {
	            throw new Error("'pack' error.");
	          } else {
	            valStr = String.fromCharCode(Math.floor(val / 0x1000000)) + String.fromCharCode(Math.floor(val % 0x1000000 / 0x10000)) + String.fromCharCode(Math.floor(val % 0x10000 / 0x100)) + String.fromCharCode(val % 0x100);

	            if (littleEndian) {
	              valStr = valStr.split("").reverse().join("");
	            }
	          }
	        } else {
	          throw new Error("'pack' error.");
	        }

	        packed += valStr;
	        p += 1;
	      }

	      return packed;
	    }

	    function unpack(mark, str) {
	      if (typeof str != "string") {
	        throw new Error("'unpack' error. Got invalid type argument.");
	      }

	      var l = 0;

	      for (var markPointer = 1; markPointer < mark.length; markPointer++) {
	        if (mark[markPointer].toLowerCase() == "b") {
	          l += 1;
	        } else if (mark[markPointer].toLowerCase() == "h") {
	          l += 2;
	        } else if (mark[markPointer].toLowerCase() == "l") {
	          l += 4;
	        } else {
	          throw new Error("'unpack' error. Got invalid mark.");
	        }
	      }

	      if (l != str.length) {
	        throw new Error("'unpack' error. Mismatch between symbol and string length. " + l + ":" + str.length);
	      }

	      var littleEndian;

	      if (mark[0] == "<") {
	        littleEndian = true;
	      } else if (mark[0] == ">") {
	        littleEndian = false;
	      } else {
	        throw new Error("'unpack' error.");
	      }

	      var unpacked = [];
	      var strPointer = 0;
	      var p = 1;
	      var val = null;
	      var c = null;
	      var length = null;
	      var sliced = "";

	      while (c = mark[p]) {
	        if (c.toLowerCase() == "b") {
	          length = 1;
	          sliced = str.slice(strPointer, strPointer + length);
	          val = sliced.charCodeAt(0);

	          if (c == "b" && val >= 0x80) {
	            val -= 0x100;
	          }
	        } else if (c == "H") {
	          length = 2;
	          sliced = str.slice(strPointer, strPointer + length);

	          if (littleEndian) {
	            sliced = sliced.split("").reverse().join("");
	          }

	          val = sliced.charCodeAt(0) * 0x100 + sliced.charCodeAt(1);
	        } else if (c.toLowerCase() == "l") {
	          length = 4;
	          sliced = str.slice(strPointer, strPointer + length);

	          if (littleEndian) {
	            sliced = sliced.split("").reverse().join("");
	          }

	          val = sliced.charCodeAt(0) * 0x1000000 + sliced.charCodeAt(1) * 0x10000 + sliced.charCodeAt(2) * 0x100 + sliced.charCodeAt(3);

	          if (c == "l" && val >= 0x80000000) {
	            val -= 0x100000000;
	          }
	        } else {
	          throw new Error("'unpack' error. " + c);
	        }

	        unpacked.push(val);
	        strPointer += length;
	        p += 1;
	      }

	      return unpacked;
	    }

	    function nStr(ch, num) {
	      var str = "";

	      for (var i = 0; i < num; i++) {
	        str += ch;
	      }

	      return str;
	    }

	    function splitIntoSegments(data) {
	      if (data.slice(0, 2) != "\xff\xd8") {
	        throw new Error("Given data isn't JPEG.");
	      }

	      var head = 2;
	      var segments = ["\xff\xd8"];

	      while (true) {
	        if (data.slice(head, head + 2) == "\xff\xda") {
	          segments.push(data.slice(head));
	          break;
	        } else {
	          var length = unpack(">H", data.slice(head + 2, head + 4))[0];
	          var endPoint = head + length + 2;
	          segments.push(data.slice(head, endPoint));
	          head = endPoint;
	        }

	        if (head >= data.length) {
	          throw new Error("Wrong JPEG data.");
	        }
	      }

	      return segments;
	    }

	    function getExifSeg(segments) {
	      var seg;

	      for (var i = 0; i < segments.length; i++) {
	        seg = segments[i];

	        if (seg.slice(0, 2) == "\xff\xe1" && seg.slice(4, 10) == "Exif\x00\x00") {
	          return seg;
	        }
	      }

	      return null;
	    }

	    function mergeSegments(segments, exif) {
	      var hasExifSegment = false;
	      var additionalAPP1ExifSegments = [];
	      segments.forEach(function (segment, i) {
	        // Replace first occurence of APP1:Exif segment
	        if (segment.slice(0, 2) == "\xff\xe1" && segment.slice(4, 10) == "Exif\x00\x00") {
	          if (!hasExifSegment) {
	            segments[i] = exif;
	            hasExifSegment = true;
	          } else {
	            additionalAPP1ExifSegments.unshift(i);
	          }
	        }
	      }); // Remove additional occurences of APP1:Exif segment

	      additionalAPP1ExifSegments.forEach(function (segmentIndex) {
	        segments.splice(segmentIndex, 1);
	      });

	      if (!hasExifSegment && exif) {
	        segments = [segments[0], exif].concat(segments.slice(1));
	      }

	      return segments.join("");
	    }

	    var TYPES = {
	      "Byte": 1,
	      "Ascii": 2,
	      "Short": 3,
	      "Long": 4,
	      "Rational": 5,
	      "Undefined": 7,
	      "SLong": 9,
	      "SRational": 10
	    };
	    var TAGS = {
	      'Image': {
	        11: {
	          'name': 'ProcessingSoftware',
	          'type': 'Ascii'
	        },
	        254: {
	          'name': 'NewSubfileType',
	          'type': 'Long'
	        },
	        255: {
	          'name': 'SubfileType',
	          'type': 'Short'
	        },
	        256: {
	          'name': 'ImageWidth',
	          'type': 'Long'
	        },
	        257: {
	          'name': 'ImageLength',
	          'type': 'Long'
	        },
	        258: {
	          'name': 'BitsPerSample',
	          'type': 'Short'
	        },
	        259: {
	          'name': 'Compression',
	          'type': 'Short'
	        },
	        262: {
	          'name': 'PhotometricInterpretation',
	          'type': 'Short'
	        },
	        263: {
	          'name': 'Threshholding',
	          'type': 'Short'
	        },
	        264: {
	          'name': 'CellWidth',
	          'type': 'Short'
	        },
	        265: {
	          'name': 'CellLength',
	          'type': 'Short'
	        },
	        266: {
	          'name': 'FillOrder',
	          'type': 'Short'
	        },
	        269: {
	          'name': 'DocumentName',
	          'type': 'Ascii'
	        },
	        270: {
	          'name': 'ImageDescription',
	          'type': 'Ascii'
	        },
	        271: {
	          'name': 'Make',
	          'type': 'Ascii'
	        },
	        272: {
	          'name': 'Model',
	          'type': 'Ascii'
	        },
	        273: {
	          'name': 'StripOffsets',
	          'type': 'Long'
	        },
	        274: {
	          'name': 'Orientation',
	          'type': 'Short'
	        },
	        277: {
	          'name': 'SamplesPerPixel',
	          'type': 'Short'
	        },
	        278: {
	          'name': 'RowsPerStrip',
	          'type': 'Long'
	        },
	        279: {
	          'name': 'StripByteCounts',
	          'type': 'Long'
	        },
	        282: {
	          'name': 'XResolution',
	          'type': 'Rational'
	        },
	        283: {
	          'name': 'YResolution',
	          'type': 'Rational'
	        },
	        284: {
	          'name': 'PlanarConfiguration',
	          'type': 'Short'
	        },
	        290: {
	          'name': 'GrayResponseUnit',
	          'type': 'Short'
	        },
	        291: {
	          'name': 'GrayResponseCurve',
	          'type': 'Short'
	        },
	        292: {
	          'name': 'T4Options',
	          'type': 'Long'
	        },
	        293: {
	          'name': 'T6Options',
	          'type': 'Long'
	        },
	        296: {
	          'name': 'ResolutionUnit',
	          'type': 'Short'
	        },
	        301: {
	          'name': 'TransferFunction',
	          'type': 'Short'
	        },
	        305: {
	          'name': 'Software',
	          'type': 'Ascii'
	        },
	        306: {
	          'name': 'DateTime',
	          'type': 'Ascii'
	        },
	        315: {
	          'name': 'Artist',
	          'type': 'Ascii'
	        },
	        316: {
	          'name': 'HostComputer',
	          'type': 'Ascii'
	        },
	        317: {
	          'name': 'Predictor',
	          'type': 'Short'
	        },
	        318: {
	          'name': 'WhitePoint',
	          'type': 'Rational'
	        },
	        319: {
	          'name': 'PrimaryChromaticities',
	          'type': 'Rational'
	        },
	        320: {
	          'name': 'ColorMap',
	          'type': 'Short'
	        },
	        321: {
	          'name': 'HalftoneHints',
	          'type': 'Short'
	        },
	        322: {
	          'name': 'TileWidth',
	          'type': 'Short'
	        },
	        323: {
	          'name': 'TileLength',
	          'type': 'Short'
	        },
	        324: {
	          'name': 'TileOffsets',
	          'type': 'Short'
	        },
	        325: {
	          'name': 'TileByteCounts',
	          'type': 'Short'
	        },
	        330: {
	          'name': 'SubIFDs',
	          'type': 'Long'
	        },
	        332: {
	          'name': 'InkSet',
	          'type': 'Short'
	        },
	        333: {
	          'name': 'InkNames',
	          'type': 'Ascii'
	        },
	        334: {
	          'name': 'NumberOfInks',
	          'type': 'Short'
	        },
	        336: {
	          'name': 'DotRange',
	          'type': 'Byte'
	        },
	        337: {
	          'name': 'TargetPrinter',
	          'type': 'Ascii'
	        },
	        338: {
	          'name': 'ExtraSamples',
	          'type': 'Short'
	        },
	        339: {
	          'name': 'SampleFormat',
	          'type': 'Short'
	        },
	        340: {
	          'name': 'SMinSampleValue',
	          'type': 'Short'
	        },
	        341: {
	          'name': 'SMaxSampleValue',
	          'type': 'Short'
	        },
	        342: {
	          'name': 'TransferRange',
	          'type': 'Short'
	        },
	        343: {
	          'name': 'ClipPath',
	          'type': 'Byte'
	        },
	        344: {
	          'name': 'XClipPathUnits',
	          'type': 'Long'
	        },
	        345: {
	          'name': 'YClipPathUnits',
	          'type': 'Long'
	        },
	        346: {
	          'name': 'Indexed',
	          'type': 'Short'
	        },
	        347: {
	          'name': 'JPEGTables',
	          'type': 'Undefined'
	        },
	        351: {
	          'name': 'OPIProxy',
	          'type': 'Short'
	        },
	        512: {
	          'name': 'JPEGProc',
	          'type': 'Long'
	        },
	        513: {
	          'name': 'JPEGInterchangeFormat',
	          'type': 'Long'
	        },
	        514: {
	          'name': 'JPEGInterchangeFormatLength',
	          'type': 'Long'
	        },
	        515: {
	          'name': 'JPEGRestartInterval',
	          'type': 'Short'
	        },
	        517: {
	          'name': 'JPEGLosslessPredictors',
	          'type': 'Short'
	        },
	        518: {
	          'name': 'JPEGPointTransforms',
	          'type': 'Short'
	        },
	        519: {
	          'name': 'JPEGQTables',
	          'type': 'Long'
	        },
	        520: {
	          'name': 'JPEGDCTables',
	          'type': 'Long'
	        },
	        521: {
	          'name': 'JPEGACTables',
	          'type': 'Long'
	        },
	        529: {
	          'name': 'YCbCrCoefficients',
	          'type': 'Rational'
	        },
	        530: {
	          'name': 'YCbCrSubSampling',
	          'type': 'Short'
	        },
	        531: {
	          'name': 'YCbCrPositioning',
	          'type': 'Short'
	        },
	        532: {
	          'name': 'ReferenceBlackWhite',
	          'type': 'Rational'
	        },
	        700: {
	          'name': 'XMLPacket',
	          'type': 'Byte'
	        },
	        18246: {
	          'name': 'Rating',
	          'type': 'Short'
	        },
	        18249: {
	          'name': 'RatingPercent',
	          'type': 'Short'
	        },
	        32781: {
	          'name': 'ImageID',
	          'type': 'Ascii'
	        },
	        33421: {
	          'name': 'CFARepeatPatternDim',
	          'type': 'Short'
	        },
	        33422: {
	          'name': 'CFAPattern',
	          'type': 'Byte'
	        },
	        33423: {
	          'name': 'BatteryLevel',
	          'type': 'Rational'
	        },
	        33432: {
	          'name': 'Copyright',
	          'type': 'Ascii'
	        },
	        33434: {
	          'name': 'ExposureTime',
	          'type': 'Rational'
	        },
	        34377: {
	          'name': 'ImageResources',
	          'type': 'Byte'
	        },
	        34665: {
	          'name': 'ExifTag',
	          'type': 'Long'
	        },
	        34675: {
	          'name': 'InterColorProfile',
	          'type': 'Undefined'
	        },
	        34853: {
	          'name': 'GPSTag',
	          'type': 'Long'
	        },
	        34857: {
	          'name': 'Interlace',
	          'type': 'Short'
	        },
	        34858: {
	          'name': 'TimeZoneOffset',
	          'type': 'Long'
	        },
	        34859: {
	          'name': 'SelfTimerMode',
	          'type': 'Short'
	        },
	        37387: {
	          'name': 'FlashEnergy',
	          'type': 'Rational'
	        },
	        37388: {
	          'name': 'SpatialFrequencyResponse',
	          'type': 'Undefined'
	        },
	        37389: {
	          'name': 'Noise',
	          'type': 'Undefined'
	        },
	        37390: {
	          'name': 'FocalPlaneXResolution',
	          'type': 'Rational'
	        },
	        37391: {
	          'name': 'FocalPlaneYResolution',
	          'type': 'Rational'
	        },
	        37392: {
	          'name': 'FocalPlaneResolutionUnit',
	          'type': 'Short'
	        },
	        37393: {
	          'name': 'ImageNumber',
	          'type': 'Long'
	        },
	        37394: {
	          'name': 'SecurityClassification',
	          'type': 'Ascii'
	        },
	        37395: {
	          'name': 'ImageHistory',
	          'type': 'Ascii'
	        },
	        37397: {
	          'name': 'ExposureIndex',
	          'type': 'Rational'
	        },
	        37398: {
	          'name': 'TIFFEPStandardID',
	          'type': 'Byte'
	        },
	        37399: {
	          'name': 'SensingMethod',
	          'type': 'Short'
	        },
	        40091: {
	          'name': 'XPTitle',
	          'type': 'Byte'
	        },
	        40092: {
	          'name': 'XPComment',
	          'type': 'Byte'
	        },
	        40093: {
	          'name': 'XPAuthor',
	          'type': 'Byte'
	        },
	        40094: {
	          'name': 'XPKeywords',
	          'type': 'Byte'
	        },
	        40095: {
	          'name': 'XPSubject',
	          'type': 'Byte'
	        },
	        50341: {
	          'name': 'PrintImageMatching',
	          'type': 'Undefined'
	        },
	        50706: {
	          'name': 'DNGVersion',
	          'type': 'Byte'
	        },
	        50707: {
	          'name': 'DNGBackwardVersion',
	          'type': 'Byte'
	        },
	        50708: {
	          'name': 'UniqueCameraModel',
	          'type': 'Ascii'
	        },
	        50709: {
	          'name': 'LocalizedCameraModel',
	          'type': 'Byte'
	        },
	        50710: {
	          'name': 'CFAPlaneColor',
	          'type': 'Byte'
	        },
	        50711: {
	          'name': 'CFALayout',
	          'type': 'Short'
	        },
	        50712: {
	          'name': 'LinearizationTable',
	          'type': 'Short'
	        },
	        50713: {
	          'name': 'BlackLevelRepeatDim',
	          'type': 'Short'
	        },
	        50714: {
	          'name': 'BlackLevel',
	          'type': 'Rational'
	        },
	        50715: {
	          'name': 'BlackLevelDeltaH',
	          'type': 'SRational'
	        },
	        50716: {
	          'name': 'BlackLevelDeltaV',
	          'type': 'SRational'
	        },
	        50717: {
	          'name': 'WhiteLevel',
	          'type': 'Short'
	        },
	        50718: {
	          'name': 'DefaultScale',
	          'type': 'Rational'
	        },
	        50719: {
	          'name': 'DefaultCropOrigin',
	          'type': 'Short'
	        },
	        50720: {
	          'name': 'DefaultCropSize',
	          'type': 'Short'
	        },
	        50721: {
	          'name': 'ColorMatrix1',
	          'type': 'SRational'
	        },
	        50722: {
	          'name': 'ColorMatrix2',
	          'type': 'SRational'
	        },
	        50723: {
	          'name': 'CameraCalibration1',
	          'type': 'SRational'
	        },
	        50724: {
	          'name': 'CameraCalibration2',
	          'type': 'SRational'
	        },
	        50725: {
	          'name': 'ReductionMatrix1',
	          'type': 'SRational'
	        },
	        50726: {
	          'name': 'ReductionMatrix2',
	          'type': 'SRational'
	        },
	        50727: {
	          'name': 'AnalogBalance',
	          'type': 'Rational'
	        },
	        50728: {
	          'name': 'AsShotNeutral',
	          'type': 'Short'
	        },
	        50729: {
	          'name': 'AsShotWhiteXY',
	          'type': 'Rational'
	        },
	        50730: {
	          'name': 'BaselineExposure',
	          'type': 'SRational'
	        },
	        50731: {
	          'name': 'BaselineNoise',
	          'type': 'Rational'
	        },
	        50732: {
	          'name': 'BaselineSharpness',
	          'type': 'Rational'
	        },
	        50733: {
	          'name': 'BayerGreenSplit',
	          'type': 'Long'
	        },
	        50734: {
	          'name': 'LinearResponseLimit',
	          'type': 'Rational'
	        },
	        50735: {
	          'name': 'CameraSerialNumber',
	          'type': 'Ascii'
	        },
	        50736: {
	          'name': 'LensInfo',
	          'type': 'Rational'
	        },
	        50737: {
	          'name': 'ChromaBlurRadius',
	          'type': 'Rational'
	        },
	        50738: {
	          'name': 'AntiAliasStrength',
	          'type': 'Rational'
	        },
	        50739: {
	          'name': 'ShadowScale',
	          'type': 'SRational'
	        },
	        50740: {
	          'name': 'DNGPrivateData',
	          'type': 'Byte'
	        },
	        50741: {
	          'name': 'MakerNoteSafety',
	          'type': 'Short'
	        },
	        50778: {
	          'name': 'CalibrationIlluminant1',
	          'type': 'Short'
	        },
	        50779: {
	          'name': 'CalibrationIlluminant2',
	          'type': 'Short'
	        },
	        50780: {
	          'name': 'BestQualityScale',
	          'type': 'Rational'
	        },
	        50781: {
	          'name': 'RawDataUniqueID',
	          'type': 'Byte'
	        },
	        50827: {
	          'name': 'OriginalRawFileName',
	          'type': 'Byte'
	        },
	        50828: {
	          'name': 'OriginalRawFileData',
	          'type': 'Undefined'
	        },
	        50829: {
	          'name': 'ActiveArea',
	          'type': 'Short'
	        },
	        50830: {
	          'name': 'MaskedAreas',
	          'type': 'Short'
	        },
	        50831: {
	          'name': 'AsShotICCProfile',
	          'type': 'Undefined'
	        },
	        50832: {
	          'name': 'AsShotPreProfileMatrix',
	          'type': 'SRational'
	        },
	        50833: {
	          'name': 'CurrentICCProfile',
	          'type': 'Undefined'
	        },
	        50834: {
	          'name': 'CurrentPreProfileMatrix',
	          'type': 'SRational'
	        },
	        50879: {
	          'name': 'ColorimetricReference',
	          'type': 'Short'
	        },
	        50931: {
	          'name': 'CameraCalibrationSignature',
	          'type': 'Byte'
	        },
	        50932: {
	          'name': 'ProfileCalibrationSignature',
	          'type': 'Byte'
	        },
	        50934: {
	          'name': 'AsShotProfileName',
	          'type': 'Byte'
	        },
	        50935: {
	          'name': 'NoiseReductionApplied',
	          'type': 'Rational'
	        },
	        50936: {
	          'name': 'ProfileName',
	          'type': 'Byte'
	        },
	        50937: {
	          'name': 'ProfileHueSatMapDims',
	          'type': 'Long'
	        },
	        50938: {
	          'name': 'ProfileHueSatMapData1',
	          'type': 'Float'
	        },
	        50939: {
	          'name': 'ProfileHueSatMapData2',
	          'type': 'Float'
	        },
	        50940: {
	          'name': 'ProfileToneCurve',
	          'type': 'Float'
	        },
	        50941: {
	          'name': 'ProfileEmbedPolicy',
	          'type': 'Long'
	        },
	        50942: {
	          'name': 'ProfileCopyright',
	          'type': 'Byte'
	        },
	        50964: {
	          'name': 'ForwardMatrix1',
	          'type': 'SRational'
	        },
	        50965: {
	          'name': 'ForwardMatrix2',
	          'type': 'SRational'
	        },
	        50966: {
	          'name': 'PreviewApplicationName',
	          'type': 'Byte'
	        },
	        50967: {
	          'name': 'PreviewApplicationVersion',
	          'type': 'Byte'
	        },
	        50968: {
	          'name': 'PreviewSettingsName',
	          'type': 'Byte'
	        },
	        50969: {
	          'name': 'PreviewSettingsDigest',
	          'type': 'Byte'
	        },
	        50970: {
	          'name': 'PreviewColorSpace',
	          'type': 'Long'
	        },
	        50971: {
	          'name': 'PreviewDateTime',
	          'type': 'Ascii'
	        },
	        50972: {
	          'name': 'RawImageDigest',
	          'type': 'Undefined'
	        },
	        50973: {
	          'name': 'OriginalRawFileDigest',
	          'type': 'Undefined'
	        },
	        50974: {
	          'name': 'SubTileBlockSize',
	          'type': 'Long'
	        },
	        50975: {
	          'name': 'RowInterleaveFactor',
	          'type': 'Long'
	        },
	        50981: {
	          'name': 'ProfileLookTableDims',
	          'type': 'Long'
	        },
	        50982: {
	          'name': 'ProfileLookTableData',
	          'type': 'Float'
	        },
	        51008: {
	          'name': 'OpcodeList1',
	          'type': 'Undefined'
	        },
	        51009: {
	          'name': 'OpcodeList2',
	          'type': 'Undefined'
	        },
	        51022: {
	          'name': 'OpcodeList3',
	          'type': 'Undefined'
	        }
	      },
	      'Exif': {
	        33434: {
	          'name': 'ExposureTime',
	          'type': 'Rational'
	        },
	        33437: {
	          'name': 'FNumber',
	          'type': 'Rational'
	        },
	        34850: {
	          'name': 'ExposureProgram',
	          'type': 'Short'
	        },
	        34852: {
	          'name': 'SpectralSensitivity',
	          'type': 'Ascii'
	        },
	        34855: {
	          'name': 'ISOSpeedRatings',
	          'type': 'Short'
	        },
	        34856: {
	          'name': 'OECF',
	          'type': 'Undefined'
	        },
	        34864: {
	          'name': 'SensitivityType',
	          'type': 'Short'
	        },
	        34865: {
	          'name': 'StandardOutputSensitivity',
	          'type': 'Long'
	        },
	        34866: {
	          'name': 'RecommendedExposureIndex',
	          'type': 'Long'
	        },
	        34867: {
	          'name': 'ISOSpeed',
	          'type': 'Long'
	        },
	        34868: {
	          'name': 'ISOSpeedLatitudeyyy',
	          'type': 'Long'
	        },
	        34869: {
	          'name': 'ISOSpeedLatitudezzz',
	          'type': 'Long'
	        },
	        36864: {
	          'name': 'ExifVersion',
	          'type': 'Undefined'
	        },
	        36867: {
	          'name': 'DateTimeOriginal',
	          'type': 'Ascii'
	        },
	        36868: {
	          'name': 'DateTimeDigitized',
	          'type': 'Ascii'
	        },
	        37121: {
	          'name': 'ComponentsConfiguration',
	          'type': 'Undefined'
	        },
	        37122: {
	          'name': 'CompressedBitsPerPixel',
	          'type': 'Rational'
	        },
	        37377: {
	          'name': 'ShutterSpeedValue',
	          'type': 'SRational'
	        },
	        37378: {
	          'name': 'ApertureValue',
	          'type': 'Rational'
	        },
	        37379: {
	          'name': 'BrightnessValue',
	          'type': 'SRational'
	        },
	        37380: {
	          'name': 'ExposureBiasValue',
	          'type': 'SRational'
	        },
	        37381: {
	          'name': 'MaxApertureValue',
	          'type': 'Rational'
	        },
	        37382: {
	          'name': 'SubjectDistance',
	          'type': 'Rational'
	        },
	        37383: {
	          'name': 'MeteringMode',
	          'type': 'Short'
	        },
	        37384: {
	          'name': 'LightSource',
	          'type': 'Short'
	        },
	        37385: {
	          'name': 'Flash',
	          'type': 'Short'
	        },
	        37386: {
	          'name': 'FocalLength',
	          'type': 'Rational'
	        },
	        37396: {
	          'name': 'SubjectArea',
	          'type': 'Short'
	        },
	        37500: {
	          'name': 'MakerNote',
	          'type': 'Undefined'
	        },
	        37510: {
	          'name': 'UserComment',
	          'type': 'Ascii'
	        },
	        37520: {
	          'name': 'SubSecTime',
	          'type': 'Ascii'
	        },
	        37521: {
	          'name': 'SubSecTimeOriginal',
	          'type': 'Ascii'
	        },
	        37522: {
	          'name': 'SubSecTimeDigitized',
	          'type': 'Ascii'
	        },
	        40960: {
	          'name': 'FlashpixVersion',
	          'type': 'Undefined'
	        },
	        40961: {
	          'name': 'ColorSpace',
	          'type': 'Short'
	        },
	        40962: {
	          'name': 'PixelXDimension',
	          'type': 'Long'
	        },
	        40963: {
	          'name': 'PixelYDimension',
	          'type': 'Long'
	        },
	        40964: {
	          'name': 'RelatedSoundFile',
	          'type': 'Ascii'
	        },
	        40965: {
	          'name': 'InteroperabilityTag',
	          'type': 'Long'
	        },
	        41483: {
	          'name': 'FlashEnergy',
	          'type': 'Rational'
	        },
	        41484: {
	          'name': 'SpatialFrequencyResponse',
	          'type': 'Undefined'
	        },
	        41486: {
	          'name': 'FocalPlaneXResolution',
	          'type': 'Rational'
	        },
	        41487: {
	          'name': 'FocalPlaneYResolution',
	          'type': 'Rational'
	        },
	        41488: {
	          'name': 'FocalPlaneResolutionUnit',
	          'type': 'Short'
	        },
	        41492: {
	          'name': 'SubjectLocation',
	          'type': 'Short'
	        },
	        41493: {
	          'name': 'ExposureIndex',
	          'type': 'Rational'
	        },
	        41495: {
	          'name': 'SensingMethod',
	          'type': 'Short'
	        },
	        41728: {
	          'name': 'FileSource',
	          'type': 'Undefined'
	        },
	        41729: {
	          'name': 'SceneType',
	          'type': 'Undefined'
	        },
	        41730: {
	          'name': 'CFAPattern',
	          'type': 'Undefined'
	        },
	        41985: {
	          'name': 'CustomRendered',
	          'type': 'Short'
	        },
	        41986: {
	          'name': 'ExposureMode',
	          'type': 'Short'
	        },
	        41987: {
	          'name': 'WhiteBalance',
	          'type': 'Short'
	        },
	        41988: {
	          'name': 'DigitalZoomRatio',
	          'type': 'Rational'
	        },
	        41989: {
	          'name': 'FocalLengthIn35mmFilm',
	          'type': 'Short'
	        },
	        41990: {
	          'name': 'SceneCaptureType',
	          'type': 'Short'
	        },
	        41991: {
	          'name': 'GainControl',
	          'type': 'Short'
	        },
	        41992: {
	          'name': 'Contrast',
	          'type': 'Short'
	        },
	        41993: {
	          'name': 'Saturation',
	          'type': 'Short'
	        },
	        41994: {
	          'name': 'Sharpness',
	          'type': 'Short'
	        },
	        41995: {
	          'name': 'DeviceSettingDescription',
	          'type': 'Undefined'
	        },
	        41996: {
	          'name': 'SubjectDistanceRange',
	          'type': 'Short'
	        },
	        42016: {
	          'name': 'ImageUniqueID',
	          'type': 'Ascii'
	        },
	        42032: {
	          'name': 'CameraOwnerName',
	          'type': 'Ascii'
	        },
	        42033: {
	          'name': 'BodySerialNumber',
	          'type': 'Ascii'
	        },
	        42034: {
	          'name': 'LensSpecification',
	          'type': 'Rational'
	        },
	        42035: {
	          'name': 'LensMake',
	          'type': 'Ascii'
	        },
	        42036: {
	          'name': 'LensModel',
	          'type': 'Ascii'
	        },
	        42037: {
	          'name': 'LensSerialNumber',
	          'type': 'Ascii'
	        },
	        42240: {
	          'name': 'Gamma',
	          'type': 'Rational'
	        }
	      },
	      'GPS': {
	        0: {
	          'name': 'GPSVersionID',
	          'type': 'Byte'
	        },
	        1: {
	          'name': 'GPSLatitudeRef',
	          'type': 'Ascii'
	        },
	        2: {
	          'name': 'GPSLatitude',
	          'type': 'Rational'
	        },
	        3: {
	          'name': 'GPSLongitudeRef',
	          'type': 'Ascii'
	        },
	        4: {
	          'name': 'GPSLongitude',
	          'type': 'Rational'
	        },
	        5: {
	          'name': 'GPSAltitudeRef',
	          'type': 'Byte'
	        },
	        6: {
	          'name': 'GPSAltitude',
	          'type': 'Rational'
	        },
	        7: {
	          'name': 'GPSTimeStamp',
	          'type': 'Rational'
	        },
	        8: {
	          'name': 'GPSSatellites',
	          'type': 'Ascii'
	        },
	        9: {
	          'name': 'GPSStatus',
	          'type': 'Ascii'
	        },
	        10: {
	          'name': 'GPSMeasureMode',
	          'type': 'Ascii'
	        },
	        11: {
	          'name': 'GPSDOP',
	          'type': 'Rational'
	        },
	        12: {
	          'name': 'GPSSpeedRef',
	          'type': 'Ascii'
	        },
	        13: {
	          'name': 'GPSSpeed',
	          'type': 'Rational'
	        },
	        14: {
	          'name': 'GPSTrackRef',
	          'type': 'Ascii'
	        },
	        15: {
	          'name': 'GPSTrack',
	          'type': 'Rational'
	        },
	        16: {
	          'name': 'GPSImgDirectionRef',
	          'type': 'Ascii'
	        },
	        17: {
	          'name': 'GPSImgDirection',
	          'type': 'Rational'
	        },
	        18: {
	          'name': 'GPSMapDatum',
	          'type': 'Ascii'
	        },
	        19: {
	          'name': 'GPSDestLatitudeRef',
	          'type': 'Ascii'
	        },
	        20: {
	          'name': 'GPSDestLatitude',
	          'type': 'Rational'
	        },
	        21: {
	          'name': 'GPSDestLongitudeRef',
	          'type': 'Ascii'
	        },
	        22: {
	          'name': 'GPSDestLongitude',
	          'type': 'Rational'
	        },
	        23: {
	          'name': 'GPSDestBearingRef',
	          'type': 'Ascii'
	        },
	        24: {
	          'name': 'GPSDestBearing',
	          'type': 'Rational'
	        },
	        25: {
	          'name': 'GPSDestDistanceRef',
	          'type': 'Ascii'
	        },
	        26: {
	          'name': 'GPSDestDistance',
	          'type': 'Rational'
	        },
	        27: {
	          'name': 'GPSProcessingMethod',
	          'type': 'Undefined'
	        },
	        28: {
	          'name': 'GPSAreaInformation',
	          'type': 'Undefined'
	        },
	        29: {
	          'name': 'GPSDateStamp',
	          'type': 'Ascii'
	        },
	        30: {
	          'name': 'GPSDifferential',
	          'type': 'Short'
	        },
	        31: {
	          'name': 'GPSHPositioningError',
	          'type': 'Rational'
	        }
	      },
	      'Interop': {
	        1: {
	          'name': 'InteroperabilityIndex',
	          'type': 'Ascii'
	        }
	      }
	    };
	    TAGS["0th"] = TAGS["Image"];
	    TAGS["1st"] = TAGS["Image"];
	    that.TAGS = TAGS;
	    that.ImageIFD = {
	      ProcessingSoftware: 11,
	      NewSubfileType: 254,
	      SubfileType: 255,
	      ImageWidth: 256,
	      ImageLength: 257,
	      BitsPerSample: 258,
	      Compression: 259,
	      PhotometricInterpretation: 262,
	      Threshholding: 263,
	      CellWidth: 264,
	      CellLength: 265,
	      FillOrder: 266,
	      DocumentName: 269,
	      ImageDescription: 270,
	      Make: 271,
	      Model: 272,
	      StripOffsets: 273,
	      Orientation: 274,
	      SamplesPerPixel: 277,
	      RowsPerStrip: 278,
	      StripByteCounts: 279,
	      XResolution: 282,
	      YResolution: 283,
	      PlanarConfiguration: 284,
	      GrayResponseUnit: 290,
	      GrayResponseCurve: 291,
	      T4Options: 292,
	      T6Options: 293,
	      ResolutionUnit: 296,
	      TransferFunction: 301,
	      Software: 305,
	      DateTime: 306,
	      Artist: 315,
	      HostComputer: 316,
	      Predictor: 317,
	      WhitePoint: 318,
	      PrimaryChromaticities: 319,
	      ColorMap: 320,
	      HalftoneHints: 321,
	      TileWidth: 322,
	      TileLength: 323,
	      TileOffsets: 324,
	      TileByteCounts: 325,
	      SubIFDs: 330,
	      InkSet: 332,
	      InkNames: 333,
	      NumberOfInks: 334,
	      DotRange: 336,
	      TargetPrinter: 337,
	      ExtraSamples: 338,
	      SampleFormat: 339,
	      SMinSampleValue: 340,
	      SMaxSampleValue: 341,
	      TransferRange: 342,
	      ClipPath: 343,
	      XClipPathUnits: 344,
	      YClipPathUnits: 345,
	      Indexed: 346,
	      JPEGTables: 347,
	      OPIProxy: 351,
	      JPEGProc: 512,
	      JPEGInterchangeFormat: 513,
	      JPEGInterchangeFormatLength: 514,
	      JPEGRestartInterval: 515,
	      JPEGLosslessPredictors: 517,
	      JPEGPointTransforms: 518,
	      JPEGQTables: 519,
	      JPEGDCTables: 520,
	      JPEGACTables: 521,
	      YCbCrCoefficients: 529,
	      YCbCrSubSampling: 530,
	      YCbCrPositioning: 531,
	      ReferenceBlackWhite: 532,
	      XMLPacket: 700,
	      Rating: 18246,
	      RatingPercent: 18249,
	      ImageID: 32781,
	      CFARepeatPatternDim: 33421,
	      CFAPattern: 33422,
	      BatteryLevel: 33423,
	      Copyright: 33432,
	      ExposureTime: 33434,
	      ImageResources: 34377,
	      ExifTag: 34665,
	      InterColorProfile: 34675,
	      GPSTag: 34853,
	      Interlace: 34857,
	      TimeZoneOffset: 34858,
	      SelfTimerMode: 34859,
	      FlashEnergy: 37387,
	      SpatialFrequencyResponse: 37388,
	      Noise: 37389,
	      FocalPlaneXResolution: 37390,
	      FocalPlaneYResolution: 37391,
	      FocalPlaneResolutionUnit: 37392,
	      ImageNumber: 37393,
	      SecurityClassification: 37394,
	      ImageHistory: 37395,
	      ExposureIndex: 37397,
	      TIFFEPStandardID: 37398,
	      SensingMethod: 37399,
	      XPTitle: 40091,
	      XPComment: 40092,
	      XPAuthor: 40093,
	      XPKeywords: 40094,
	      XPSubject: 40095,
	      PrintImageMatching: 50341,
	      DNGVersion: 50706,
	      DNGBackwardVersion: 50707,
	      UniqueCameraModel: 50708,
	      LocalizedCameraModel: 50709,
	      CFAPlaneColor: 50710,
	      CFALayout: 50711,
	      LinearizationTable: 50712,
	      BlackLevelRepeatDim: 50713,
	      BlackLevel: 50714,
	      BlackLevelDeltaH: 50715,
	      BlackLevelDeltaV: 50716,
	      WhiteLevel: 50717,
	      DefaultScale: 50718,
	      DefaultCropOrigin: 50719,
	      DefaultCropSize: 50720,
	      ColorMatrix1: 50721,
	      ColorMatrix2: 50722,
	      CameraCalibration1: 50723,
	      CameraCalibration2: 50724,
	      ReductionMatrix1: 50725,
	      ReductionMatrix2: 50726,
	      AnalogBalance: 50727,
	      AsShotNeutral: 50728,
	      AsShotWhiteXY: 50729,
	      BaselineExposure: 50730,
	      BaselineNoise: 50731,
	      BaselineSharpness: 50732,
	      BayerGreenSplit: 50733,
	      LinearResponseLimit: 50734,
	      CameraSerialNumber: 50735,
	      LensInfo: 50736,
	      ChromaBlurRadius: 50737,
	      AntiAliasStrength: 50738,
	      ShadowScale: 50739,
	      DNGPrivateData: 50740,
	      MakerNoteSafety: 50741,
	      CalibrationIlluminant1: 50778,
	      CalibrationIlluminant2: 50779,
	      BestQualityScale: 50780,
	      RawDataUniqueID: 50781,
	      OriginalRawFileName: 50827,
	      OriginalRawFileData: 50828,
	      ActiveArea: 50829,
	      MaskedAreas: 50830,
	      AsShotICCProfile: 50831,
	      AsShotPreProfileMatrix: 50832,
	      CurrentICCProfile: 50833,
	      CurrentPreProfileMatrix: 50834,
	      ColorimetricReference: 50879,
	      CameraCalibrationSignature: 50931,
	      ProfileCalibrationSignature: 50932,
	      AsShotProfileName: 50934,
	      NoiseReductionApplied: 50935,
	      ProfileName: 50936,
	      ProfileHueSatMapDims: 50937,
	      ProfileHueSatMapData1: 50938,
	      ProfileHueSatMapData2: 50939,
	      ProfileToneCurve: 50940,
	      ProfileEmbedPolicy: 50941,
	      ProfileCopyright: 50942,
	      ForwardMatrix1: 50964,
	      ForwardMatrix2: 50965,
	      PreviewApplicationName: 50966,
	      PreviewApplicationVersion: 50967,
	      PreviewSettingsName: 50968,
	      PreviewSettingsDigest: 50969,
	      PreviewColorSpace: 50970,
	      PreviewDateTime: 50971,
	      RawImageDigest: 50972,
	      OriginalRawFileDigest: 50973,
	      SubTileBlockSize: 50974,
	      RowInterleaveFactor: 50975,
	      ProfileLookTableDims: 50981,
	      ProfileLookTableData: 50982,
	      OpcodeList1: 51008,
	      OpcodeList2: 51009,
	      OpcodeList3: 51022,
	      NoiseProfile: 51041
	    };
	    that.ExifIFD = {
	      ExposureTime: 33434,
	      FNumber: 33437,
	      ExposureProgram: 34850,
	      SpectralSensitivity: 34852,
	      ISOSpeedRatings: 34855,
	      OECF: 34856,
	      SensitivityType: 34864,
	      StandardOutputSensitivity: 34865,
	      RecommendedExposureIndex: 34866,
	      ISOSpeed: 34867,
	      ISOSpeedLatitudeyyy: 34868,
	      ISOSpeedLatitudezzz: 34869,
	      ExifVersion: 36864,
	      DateTimeOriginal: 36867,
	      DateTimeDigitized: 36868,
	      ComponentsConfiguration: 37121,
	      CompressedBitsPerPixel: 37122,
	      ShutterSpeedValue: 37377,
	      ApertureValue: 37378,
	      BrightnessValue: 37379,
	      ExposureBiasValue: 37380,
	      MaxApertureValue: 37381,
	      SubjectDistance: 37382,
	      MeteringMode: 37383,
	      LightSource: 37384,
	      Flash: 37385,
	      FocalLength: 37386,
	      SubjectArea: 37396,
	      MakerNote: 37500,
	      UserComment: 37510,
	      SubSecTime: 37520,
	      SubSecTimeOriginal: 37521,
	      SubSecTimeDigitized: 37522,
	      FlashpixVersion: 40960,
	      ColorSpace: 40961,
	      PixelXDimension: 40962,
	      PixelYDimension: 40963,
	      RelatedSoundFile: 40964,
	      InteroperabilityTag: 40965,
	      FlashEnergy: 41483,
	      SpatialFrequencyResponse: 41484,
	      FocalPlaneXResolution: 41486,
	      FocalPlaneYResolution: 41487,
	      FocalPlaneResolutionUnit: 41488,
	      SubjectLocation: 41492,
	      ExposureIndex: 41493,
	      SensingMethod: 41495,
	      FileSource: 41728,
	      SceneType: 41729,
	      CFAPattern: 41730,
	      CustomRendered: 41985,
	      ExposureMode: 41986,
	      WhiteBalance: 41987,
	      DigitalZoomRatio: 41988,
	      FocalLengthIn35mmFilm: 41989,
	      SceneCaptureType: 41990,
	      GainControl: 41991,
	      Contrast: 41992,
	      Saturation: 41993,
	      Sharpness: 41994,
	      DeviceSettingDescription: 41995,
	      SubjectDistanceRange: 41996,
	      ImageUniqueID: 42016,
	      CameraOwnerName: 42032,
	      BodySerialNumber: 42033,
	      LensSpecification: 42034,
	      LensMake: 42035,
	      LensModel: 42036,
	      LensSerialNumber: 42037,
	      Gamma: 42240
	    };
	    that.GPSIFD = {
	      GPSVersionID: 0,
	      GPSLatitudeRef: 1,
	      GPSLatitude: 2,
	      GPSLongitudeRef: 3,
	      GPSLongitude: 4,
	      GPSAltitudeRef: 5,
	      GPSAltitude: 6,
	      GPSTimeStamp: 7,
	      GPSSatellites: 8,
	      GPSStatus: 9,
	      GPSMeasureMode: 10,
	      GPSDOP: 11,
	      GPSSpeedRef: 12,
	      GPSSpeed: 13,
	      GPSTrackRef: 14,
	      GPSTrack: 15,
	      GPSImgDirectionRef: 16,
	      GPSImgDirection: 17,
	      GPSMapDatum: 18,
	      GPSDestLatitudeRef: 19,
	      GPSDestLatitude: 20,
	      GPSDestLongitudeRef: 21,
	      GPSDestLongitude: 22,
	      GPSDestBearingRef: 23,
	      GPSDestBearing: 24,
	      GPSDestDistanceRef: 25,
	      GPSDestDistance: 26,
	      GPSProcessingMethod: 27,
	      GPSAreaInformation: 28,
	      GPSDateStamp: 29,
	      GPSDifferential: 30,
	      GPSHPositioningError: 31
	    };
	    that.InteropIFD = {
	      InteroperabilityIndex: 1
	    };
	    that.GPSHelper = {
	      degToDmsRational: function degToDmsRational(degFloat) {
	        var degAbs = Math.abs(degFloat);
	        var minFloat = degAbs % 1 * 60;
	        var secFloat = minFloat % 1 * 60;
	        var deg = Math.floor(degAbs);
	        var min = Math.floor(minFloat);
	        var sec = Math.round(secFloat * 100);
	        return [[deg, 1], [min, 1], [sec, 100]];
	      },
	      dmsRationalToDeg: function dmsRationalToDeg(dmsArray, ref) {
	        var sign = ref === 'S' || ref === 'W' ? -1.0 : 1.0;
	        var deg = dmsArray[0][0] / dmsArray[0][1] + dmsArray[1][0] / dmsArray[1][1] / 60.0 + dmsArray[2][0] / dmsArray[2][1] / 3600.0;
	        return deg * sign;
	      }
	    };

	    {
	      if (module.exports) {
	        exports = module.exports = that;
	      }

	      exports.piexif = that;
	    }
	  })();
	});
	var piexif_1 = piexif.piexif;

	function _typeof(obj) {
	  if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
	    _typeof = function (obj) {
	      return typeof obj;
	    };
	  } else {
	    _typeof = function (obj) {
	      return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
	    };
	  }

	  return _typeof(obj);
	}

	function _defineProperty(obj, key, value) {
	  if (key in obj) {
	    Object.defineProperty(obj, key, {
	      value: value,
	      enumerable: true,
	      configurable: true,
	      writable: true
	    });
	  } else {
	    obj[key] = value;
	  }

	  return obj;
	}

	function _slicedToArray(arr, i) {
	  return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest();
	}

	function _arrayWithHoles(arr) {
	  if (Array.isArray(arr)) return arr;
	}

	function _iterableToArrayLimit(arr, i) {
	  var _arr = [];
	  var _n = true;
	  var _d = false;
	  var _e = undefined;

	  try {
	    for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
	      _arr.push(_s.value);

	      if (i && _arr.length === i) break;
	    }
	  } catch (err) {
	    _d = true;
	    _e = err;
	  } finally {
	    try {
	      if (!_n && _i["return"] != null) _i["return"]();
	    } finally {
	      if (_d) throw _e;
	    }
	  }

	  return _arr;
	}

	function _nonIterableRest() {
	  throw new TypeError("Invalid attempt to destructure non-iterable instance");
	}

	function main(str) {
	  // eslint-disable-next-line no-undef
	  if (typeof atob === 'function') return atob(str);
	  return Buffer.from(str, 'base64').toString('binary');
	}

	var atob_1 = main;

	function isDataUrl(data) {
	  return data && data.startsWith && data.startsWith('data:image/');
	}

	function convertToBuffer(data) {
	  if (!data) return null;

	  if (_typeof(data) === 'object') {
	    return data;
	  } else if (typeof data === 'string') {
	    var base64 = data;

	    if (isDataUrl(data)) {
	      base64 = dataUrlToBase64(data);
	    } else if (isBinaryString(data)) {
	      return binaryStringToBuffer(data);
	    }

	    return base64ToBuffer(base64);
	  }

	  throw new Error('fail to convert data to buffer');
	}

	function dataUrlToBase64(dataUrl) {
	  var idx = dataUrl.indexOf('base64');

	  if (idx === -1) {
	    throw new Error('input is not a valid base64 string');
	  }

	  return dataUrl.substr(idx + 7);
	}

	function base64ToBuffer(base64) {
	  return binaryStringToBuffer(atob_1(base64));
	}

	function binaryStringToBuffer(binaryStr) {
	  if (typeof binaryStr !== 'string') throw new Error('input is not a string'); // TextEncoder cannot convert binary string
	  // if (typeof TextEncoder === 'function') return (new TextEncoder()).encode(binaryStr)

	  if (typeof Buffer === 'function') return Buffer.from(binaryStr, 'binary');
	  var len = binaryStr.length;
	  var bytes = new Uint8Array(len);

	  for (var i = 0; i < len; i++) {
	    bytes[i] = binaryStr.charCodeAt(i);
	  }

	  return bytes;
	}

	function convertToBinaryString(data) {
	  if (_typeof(data) === 'object') {
	    if (data.length >= 0) {
	      // TextDecoder cannot convert binary string
	      // if (typeof TextDecoder === 'function') return (new TextDecoder()).decode(data)
	      return Array.prototype.map.call(data, function (code) {
	        return String.fromCharCode(code);
	      }).join('');
	    }
	  } else if (typeof data === 'string') {
	    if (isDataUrl(data)) {
	      return atob_1(dataUrlToBase64(data));
	    }

	    return data;
	  }

	  throw new Error('fail to convert data to binary string');
	}

	function isBinaryString(data) {
	  return typeof data === 'string' && /[^\x20-\x7E\t\r\n]/.test(data);
	}

	var dataConverter = {
	  convertToBuffer: convertToBuffer,
	  dataUrlToBase64: dataUrlToBase64,
	  base64ToBuffer: base64ToBuffer,
	  convertToBinaryString: convertToBinaryString
	};

	var WORD_SEPARATOR = '~_';
	var META_SEPARATOR = '_|';
	var SIG = 'Mt_';

	function encodeMetadata(metadata) {
	  return metadata.map(function (meta) {
	    return "".concat(meta.value);
	  }).join("");
	}

	function decodeMetadata(string) {
	  if (!string.startsWith(SIG)) return string;
	  return string.slice(SIG.length).split(META_SEPARATOR).map(function (metaStr) {
	    var _metaStr$split = metaStr.split(WORD_SEPARATOR),
	        _metaStr$split2 = _slicedToArray(_metaStr$split, 2),
	        name = _metaStr$split2[0],
	        value = _metaStr$split2[1];

	    return {
	      name: unescape(name),
	      value: unescape(value)
	    };
	  });
	}

	var metaConverter = {
	  encodeMetadata: encodeMetadata,
	  decodeMetadata: decodeMetadata
	};

	var load = piexif.load,
	    TAGS = piexif.TAGS;
	var convertToBinaryString$1 = dataConverter.convertToBinaryString;
	var decodeMetadata$1 = metaConverter.decodeMetadata;

	function metaReader(data) {
	  var binaryStr = convertToBinaryString$1(data);
	  var ret = load(binaryStr);
	  var results = [];

	  for (var key in ret) {
	    var obj = ret[key];
	    var dict = void 0;

	    if (key === '0th') {
	      dict = TAGS.Image;
	    } else if (key === 'Exif') {
	      dict = TAGS.Exif;
	    } else {
	      dict = TAGS.GPS;
	    }

	    for (var id in obj) {
	      var def = dict[id];
	      var name = def && def.name || 'unknown';

	      if (name === 'UserComment') {
	        var decoded = decodeMetadata$1(obj[id]);

	        if (Array.isArray(decoded)) {
	          decoded.forEach(function (meta) {
	            return results.push(meta);
	          });
	          continue;
	        }
	      }

	      results.push({
	        name: name,
	        value: obj[id]
	      });
	    }
	  }

	  return results;
	}

	var jpeg = metaReader;

	var crc32 = createCommonjsModule(function (module, exports) {
	  /* crc32.js (C) 2014-2015 SheetJS -- http://sheetjs.com */

	  /* vim: set ts=2: */
	  var CRC32;

	  (function (factory) {
	    if (typeof DO_NOT_EXPORT_CRC === 'undefined') {
	      {
	        factory(exports);
	      }
	    } else {
	      factory(CRC32 = {});
	    }
	  })(function (CRC32) {
	    CRC32.version = '0.3.0';
	    /* see perf/crc32table.js */

	    function signed_crc_table() {
	      var c = 0,
	          table = new Array(256);

	      for (var n = 0; n != 256; ++n) {
	        c = n;
	        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
	        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
	        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
	        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
	        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
	        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
	        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
	        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
	        table[n] = c;
	      }

	      return typeof Int32Array !== 'undefined' ? new Int32Array(table) : table;
	    }

	    var table = signed_crc_table();
	    /* charCodeAt is the best approach for binary strings */

	    var use_buffer = typeof Buffer !== 'undefined';

	    function crc32_bstr(bstr) {
	      if (bstr.length > 32768) if (use_buffer) return crc32_buf_8(new Buffer(bstr));
	      var crc = -1,
	          L = bstr.length - 1;

	      for (var i = 0; i < L;) {
	        crc = table[(crc ^ bstr.charCodeAt(i++)) & 0xFF] ^ crc >>> 8;
	        crc = table[(crc ^ bstr.charCodeAt(i++)) & 0xFF] ^ crc >>> 8;
	      }

	      if (i === L) crc = crc >>> 8 ^ table[(crc ^ bstr.charCodeAt(i)) & 0xFF];
	      return crc ^ -1;
	    }

	    function crc32_buf(buf) {
	      if (buf.length > 10000) return crc32_buf_8(buf);

	      for (var crc = -1, i = 0, L = buf.length - 3; i < L;) {
	        crc = crc >>> 8 ^ table[(crc ^ buf[i++]) & 0xFF];
	        crc = crc >>> 8 ^ table[(crc ^ buf[i++]) & 0xFF];
	        crc = crc >>> 8 ^ table[(crc ^ buf[i++]) & 0xFF];
	        crc = crc >>> 8 ^ table[(crc ^ buf[i++]) & 0xFF];
	      }

	      while (i < L + 3) {
	        crc = crc >>> 8 ^ table[(crc ^ buf[i++]) & 0xFF];
	      }

	      return crc ^ -1;
	    }

	    function crc32_buf_8(buf) {
	      for (var crc = -1, i = 0, L = buf.length - 7; i < L;) {
	        crc = crc >>> 8 ^ table[(crc ^ buf[i++]) & 0xFF];
	        crc = crc >>> 8 ^ table[(crc ^ buf[i++]) & 0xFF];
	        crc = crc >>> 8 ^ table[(crc ^ buf[i++]) & 0xFF];
	        crc = crc >>> 8 ^ table[(crc ^ buf[i++]) & 0xFF];
	        crc = crc >>> 8 ^ table[(crc ^ buf[i++]) & 0xFF];
	        crc = crc >>> 8 ^ table[(crc ^ buf[i++]) & 0xFF];
	        crc = crc >>> 8 ^ table[(crc ^ buf[i++]) & 0xFF];
	        crc = crc >>> 8 ^ table[(crc ^ buf[i++]) & 0xFF];
	      }

	      while (i < L + 7) {
	        crc = crc >>> 8 ^ table[(crc ^ buf[i++]) & 0xFF];
	      }

	      return crc ^ -1;
	    }
	    /* much much faster to intertwine utf8 and crc */


	    function crc32_str(str) {
	      for (var crc = -1, i = 0, L = str.length, c, d; i < L;) {
	        c = str.charCodeAt(i++);

	        if (c < 0x80) {
	          crc = crc >>> 8 ^ table[(crc ^ c) & 0xFF];
	        } else if (c < 0x800) {
	          crc = crc >>> 8 ^ table[(crc ^ (192 | c >> 6 & 31)) & 0xFF];
	          crc = crc >>> 8 ^ table[(crc ^ (128 | c & 63)) & 0xFF];
	        } else if (c >= 0xD800 && c < 0xE000) {
	          c = (c & 1023) + 64;
	          d = str.charCodeAt(i++) & 1023;
	          crc = crc >>> 8 ^ table[(crc ^ (240 | c >> 8 & 7)) & 0xFF];
	          crc = crc >>> 8 ^ table[(crc ^ (128 | c >> 2 & 63)) & 0xFF];
	          crc = crc >>> 8 ^ table[(crc ^ (128 | d >> 6 & 15 | c & 3)) & 0xFF];
	          crc = crc >>> 8 ^ table[(crc ^ (128 | d & 63)) & 0xFF];
	        } else {
	          crc = crc >>> 8 ^ table[(crc ^ (224 | c >> 12 & 15)) & 0xFF];
	          crc = crc >>> 8 ^ table[(crc ^ (128 | c >> 6 & 63)) & 0xFF];
	          crc = crc >>> 8 ^ table[(crc ^ (128 | c & 63)) & 0xFF];
	        }
	      }

	      return crc ^ -1;
	    }

	    CRC32.table = table;
	    CRC32.bstr = crc32_bstr;
	    CRC32.buf = crc32_buf;
	    CRC32.str = crc32_str;
	  });
	});

	var pngChunksExtract = extractChunks; // Used for fast-ish conversion between uint8s and uint32s/int32s.
	// Also required in order to remain agnostic for both Node Buffers and
	// Uint8Arrays.

	var uint8 = new Uint8Array(4);
	var int32 = new Int32Array(uint8.buffer);
	var uint32 = new Uint32Array(uint8.buffer);

	function extractChunks(data) {
	  if (data[0] !== 0x89) throw new Error('Invalid .png file header');
	  if (data[1] !== 0x50) throw new Error('Invalid .png file header');
	  if (data[2] !== 0x4E) throw new Error('Invalid .png file header');
	  if (data[3] !== 0x47) throw new Error('Invalid .png file header');
	  if (data[4] !== 0x0D) throw new Error('Invalid .png file header: possibly caused by DOS-Unix line ending conversion?');
	  if (data[5] !== 0x0A) throw new Error('Invalid .png file header: possibly caused by DOS-Unix line ending conversion?');
	  if (data[6] !== 0x1A) throw new Error('Invalid .png file header');
	  if (data[7] !== 0x0A) throw new Error('Invalid .png file header: possibly caused by DOS-Unix line ending conversion?');
	  var ended = false;
	  var chunks = [];
	  var idx = 8;

	  while (idx < data.length) {
	    // Read the length of the current chunk,
	    // which is stored as a Uint32.
	    uint8[3] = data[idx++];
	    uint8[2] = data[idx++];
	    uint8[1] = data[idx++];
	    uint8[0] = data[idx++]; // Chunk includes name/type for CRC check (see below).

	    var length = uint32[0] + 4;
	    var chunk = new Uint8Array(length);
	    chunk[0] = data[idx++];
	    chunk[1] = data[idx++];
	    chunk[2] = data[idx++];
	    chunk[3] = data[idx++]; // Get the name in ASCII for identification.

	    var name = String.fromCharCode(chunk[0]) + String.fromCharCode(chunk[1]) + String.fromCharCode(chunk[2]) + String.fromCharCode(chunk[3]); // The IHDR header MUST come first.

	    if (!chunks.length && name !== 'IHDR') {
	      throw new Error('IHDR header missing');
	    } // The IEND header marks the end of the file,
	    // so on discovering it break out of the loop.


	    if (name === 'IEND') {
	      ended = true;
	      chunks.push({
	        name: name,
	        data: new Uint8Array(0)
	      });
	      break;
	    } // Read the contents of the chunk out of the main buffer.


	    for (var i = 4; i < length; i++) {
	      chunk[i] = data[idx++];
	    } // Read out the CRC value for comparison.
	    // It's stored as an Int32.


	    uint8[3] = data[idx++];
	    uint8[2] = data[idx++];
	    uint8[1] = data[idx++];
	    uint8[0] = data[idx++];
	    var crcActual = int32[0];
	    var crcExpect = crc32.buf(chunk);

	    if (crcExpect !== crcActual) {
	      throw new Error('CRC values for ' + name + ' header do not match, PNG file is likely corrupted');
	    } // The chunk data is now copied to remove the 4 preceding
	    // bytes used for the chunk name/type.


	    var chunkData = new Uint8Array(chunk.buffer.slice(4));
	    chunks.push({
	      name: name,
	      data: chunkData
	    });
	  }

	  if (!ended) {
	    throw new Error('.png file ended prematurely: no IEND header was found');
	  }

	  return chunks;
	}

	var encode_1 = encode;

	function encode(keyword, content) {
	  keyword = String(keyword);
	  content = String(content);

	  if (!/^[\x00-\xFF]+$/.test(keyword) || !/^[\x00-\xFF]+$/.test(content)) {
	    throw new Error('Only Latin-1 characters are permitted in PNG tEXt chunks. You might want to consider base64 encoding and/or zEXt compression');
	  }

	  if (keyword.length >= 80) {
	    throw new Error('Keyword "' + keyword + '" is longer than the 79-character limit imposed by the PNG specification');
	  }

	  var totalSize = keyword.length + content.length + 1;
	  var output = new Uint8Array(totalSize);
	  var idx = 0;
	  var code;

	  for (var i = 0; i < keyword.length; i++) {
	    if (!(code = keyword.charCodeAt(i))) {
	      throw new Error('0x00 character is not permitted in tEXt keywords');
	    }

	    output[idx++] = code;
	  }

	  output[idx++] = 0;

	  for (var j = 0; j < content.length; j++) {
	    if (!(code = content.charCodeAt(j))) {
	      throw new Error('0x00 character is not permitted in tEXt content');
	    }

	    output[idx++] = code;
	  }

	  return {
	    name: 'tEXt',
	    data: output
	  };
	}

	var decode_1 = decode;

	function decode(data) {
	  if (data.data && data.name) {
	    data = data.data;
	  }

	  var naming = true;
	  var text = '';
	  var name = '';

	  for (var i = 0; i < data.length; i++) {
	    var code = data[i];

	    if (naming) {
	      if (code) {
	        name += String.fromCharCode(code);
	      } else {
	        naming = false;
	      }
	    } else {
	      if (code) {
	        text += String.fromCharCode(code);
	      } else {
	        throw new Error('Invalid NULL character found. 0x00 character is not permitted in tEXt content');
	      }
	    }
	  }

	  return {
	    keyword: name,
	    text: text
	  };
	}

	var encode$1 = encode_1;
	var decode$1 = decode_1;
	var pngChunkText = {
	  encode: encode$1,
	  decode: decode$1
	};

	var convertToBuffer$1 = dataConverter.convertToBuffer;

	function metaReader$1(data) {
	  var buffer = convertToBuffer$1(data);
	  var chunks = pngChunksExtract(buffer);
	  return chunks.filter(function (chunk) {
	    return chunk.name === 'tEXt';
	  }).map(function (chunk) {
	    var ret = pngChunkText.decode(chunk.data);
	    return {
	      name: unescape(ret.keyword),
	      value: unescape(ret.text)
	    };
	  });
	}

	var png = metaReader$1;

	/**
	 * Read Metadata from image data
	 * 
	 * @param {*} data 
	 * @param {String} mimeType 
	 */

	function readMeta(data, mimeType) {
	  if (!data || !mimeType) {
	    throw new Error('`readMeta` got invalid arguments');
	  }

	  switch (mimeType) {
	    case 'image/jpeg':
	      return jpeg(data);

	    case 'image/png':
	      return png(data);

	    default:
	      throw new Error('unsupported mimeType: ', mimeType);
	  }
	}

	var readMeta_1 = readMeta;

	function main$1(str) {
	  // eslint-disable-next-line no-undef
	  if (typeof btoa === 'function') return btoa(str);
	  var buffer;

	  if (str instanceof Buffer) {
	    buffer = str;
	  } else {
	    buffer = Buffer.from(str.toString(), 'binary');
	  }

	  return buffer.toString('base64');
	}

	var btoa_1 = main$1;

	var load$1 = piexif.load,
	    ExifIFD = piexif.ExifIFD,
	    dump = piexif.dump,
	    insert = piexif.insert;
	var convertToBuffer$2 = dataConverter.convertToBuffer,
	    convertToBinaryString$2 = dataConverter.convertToBinaryString;
	var encodeMetadata$1 = metaConverter.encodeMetadata;

	function metaWriter(data, metaData) {
	  var outputFormat = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'buffer';
	  var binaryStr = convertToBinaryString$2(data);
	  var ret = load$1(binaryStr);
	  var zeroth = ret['0th'] || {};
	  var GPS = ret.GPS || {};
	  var Exif = Object.assign({}, ret.Exif, _defineProperty({}, ExifIFD.UserComment, encodeMetadata$1(metaData)));
	  ret = {
	    '0th': zeroth,
	    Exif: Exif,
	    GPS: GPS
	  };
	  var exifStr = dump(ret);
	  binaryStr = insert(exifStr, binaryStr);
	  if (outputFormat === 'binaryString') return binaryStr;
	  if (outputFormat === 'base64') return btoa_1(binaryStr);
	  if (outputFormat === 'dataUrl') return "data:image/jpeg;base64,".concat(btoa_1(binaryStr));
	  if (outputFormat === 'buffer') return convertToBuffer$2(binaryStr);
	}

	var jpeg$1 = metaWriter;

	/**
	 * An Array.prototype.slice.call(arguments) alternative
	 *
	 * @param {Object} args something with a length
	 * @param {Number} slice
	 * @param {Number} sliceEnd
	 * @api public
	 */
	var sliced = function sliced(args, slice, sliceEnd) {
	  var ret = [];
	  var len = args.length;
	  if (0 === len) return ret;
	  var start = slice < 0 ? Math.max(0, slice + len) : slice || 0;

	  if (sliceEnd !== undefined) {
	    len = sliceEnd < 0 ? sliceEnd + len : sliceEnd;
	  }

	  while (len-- > start) {
	    ret[len - start] = args[len];
	  }

	  return ret;
	};

	var pngChunksEncode = encodeChunks; // Used for fast-ish conversion between uint8s and uint32s/int32s.
	// Also required in order to remain agnostic for both Node Buffers and
	// Uint8Arrays.

	var uint8$1 = new Uint8Array(4);
	var int32$1 = new Int32Array(uint8$1.buffer);
	var uint32$1 = new Uint32Array(uint8$1.buffer);

	function encodeChunks(chunks) {
	  var totalSize = 8;
	  var idx = totalSize;
	  var i;

	  for (i = 0; i < chunks.length; i++) {
	    totalSize += chunks[i].data.length;
	    totalSize += 12;
	  }

	  var output = new Uint8Array(totalSize);
	  output[0] = 0x89;
	  output[1] = 0x50;
	  output[2] = 0x4E;
	  output[3] = 0x47;
	  output[4] = 0x0D;
	  output[5] = 0x0A;
	  output[6] = 0x1A;
	  output[7] = 0x0A;

	  for (i = 0; i < chunks.length; i++) {
	    var chunk = chunks[i];
	    var name = chunk.name;
	    var data = chunk.data;
	    var size = data.length;
	    var nameChars = [name.charCodeAt(0), name.charCodeAt(1), name.charCodeAt(2), name.charCodeAt(3)];
	    uint32$1[0] = size;
	    output[idx++] = uint8$1[3];
	    output[idx++] = uint8$1[2];
	    output[idx++] = uint8$1[1];
	    output[idx++] = uint8$1[0];
	    output[idx++] = nameChars[0];
	    output[idx++] = nameChars[1];
	    output[idx++] = nameChars[2];
	    output[idx++] = nameChars[3];

	    for (var j = 0; j < size;) {
	      output[idx++] = data[j++];
	    }

	    var crcCheck = nameChars.concat(sliced(data));
	    var crc = crc32.buf(crcCheck);
	    int32$1[0] = crc;
	    output[idx++] = uint8$1[3];
	    output[idx++] = uint8$1[2];
	    output[idx++] = uint8$1[1];
	    output[idx++] = uint8$1[0];
	  }

	  return output;
	}

	var convertToBuffer$3 = dataConverter.convertToBuffer,
	    convertToBinaryString$3 = dataConverter.convertToBinaryString;

	function metaWriter$1(data, metaData) {
	  var outputFormat = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'buffer';
	  var buffer = convertToBuffer$3(data);
	  var chunks = pngChunksExtract(buffer); // remove all duplicated meta first

	  for (var i = chunks.length - 1; i >= 0; i--) {
	    var chunk = chunks[i];

	    if (chunk.name !== 'tEXt') {
	      continue;
	    }

	    var ret = pngChunkText.decode(chunk.data);

	    for (var j = 0; j < metaData.length; j++) {
	      var meta = metaData[j];

	      if (meta.name === ret.keyword && meta.value === ret.text) {
	        chunks.splice(i, 1);
	        break;
	      }
	    }
	  } // insert meta


	  for (var _i = 0; _i < metaData.length; _i++) {
	    var _meta = metaData[_i];
	    var value = _meta.value;

	    if (value.length === 0) {
	      value = 'null';
	    }

	    chunks.splice(-1, 0, pngChunkText.encode(_meta.name, value));
	  }

	  var arrayBuffer = pngChunksEncode(chunks);
	  if (outputFormat === 'binaryString') return convertToBinaryString$3(arrayBuffer);
	  if (outputFormat === 'base64') return btoa_1(convertToBinaryString$3(arrayBuffer));
	  if (outputFormat === 'dataUrl') return "data:image/png;base64,".concat(btoa_1(convertToBinaryString$3(arrayBuffer)));
	  if (outputFormat === 'buffer') return arrayBuffer;
	}

	var png$1 = metaWriter$1;

	/**
	 * Write Metadata into image data
	 * 
	 * @param {*} data 
	 * @param {String} mimeType 
	 * @param {Array} metaData
	 * @param {String} outputFormat
	 *                 options: base64, binaryString, buffer, dataUrl
	 */

	function writeMeta(data, mimeType, metaData, outputFormat) {
	  if (!data || !mimeType || !metaData || !outputFormat) {
	    throw new Error('`writeMeta` got invalid arguments');
	  }

	  switch (mimeType) {
	    case 'image/jpeg':
	      return jpeg$1(data, metaData, outputFormat);

	    case 'image/png':
	      return png$1(data, metaData, outputFormat);

	    default:
	      throw new Error('unsupported mimeType: ', mimeType);
	  }
	}

	var writeMeta_1 = writeMeta;

	var src = {
	  readMeta: readMeta_1,
	  writeMeta: writeMeta_1
	};
	var src_1 = src.readMeta;
	var src_2 = src.writeMeta;

	exports.default = src;
	exports.readMeta = src_1;
	exports.writeMeta = src_2;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=index.umd.js.map
