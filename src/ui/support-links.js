// No row or separator is emitted when a distribution disables these entries.
export function supportLinks({project=true,donation=true}={}) {
 const links=[];
 if(project)links.push('<a href="https://github.com/zxxf18/luoye-artboard" target="_blank" rel="noopener noreferrer">项目地址</a>');
 if(donation)links.push('<a href="https://index.yebuluo.com.cn/donate/" target="_blank" rel="noopener noreferrer">支持作者</a>');
 return links.length?`<p class="about-links">${links.join('<span class="about-links-sep" aria-hidden="true">·</span>')}</p>`:'';
}
